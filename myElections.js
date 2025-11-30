document.addEventListener('DOMContentLoaded', async function() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));

  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }

  const myElectionsList = document.getElementById('myElectionsList');
  const myElectionsError = document.getElementById('myElectionsError');
  const myElectionsSuccess = document.getElementById('myElectionsSuccess');

  // --------------------------------------------------------------------
  // 🔥 FIREBASE: LOAD USER'S ELECTIONS FROM FIRESTORE
  // --------------------------------------------------------------------
  let firebaseElections = [];
  try {
    const user = auth.currentUser;

    if (user) {
      const snapshot = await db
        .collection("polls")
        .where("ownerUID", "==", user.uid)
        .get();

      snapshot.forEach(doc => {
        firebaseElections.push({
          firebaseId: doc.id,
          ...doc.data()
        });
      });

      console.log("Firebase My Elections:", firebaseElections);
    }
  } catch (err) {
    console.warn("Could not load Firebase elections:", err);
  }

  // -------------------------------------------------------
  // ORIGINAL LOCAL STORAGE ELECTIONS
  // -------------------------------------------------------
  let localElections = JSON.parse(localStorage.getItem('elections') || '[]');

  // -------------------------------------------------------
  // 🔥 MERGE FIREBASE + LOCAL
  // -------------------------------------------------------
  let elections = [...firebaseElections, ...localElections];

  // ------------------ AUTO-CLOSE LOCAL ELECTIONS -----------------------
  function autoCloseElections() {
    let changed = false;
    const now = new Date();

    localElections.forEach(election => {
      if (!election.isClosed && election.endAt) {
        const endTime = new Date(election.endAt);
        if (!isNaN(endTime.getTime()) && now >= endTime) {
          election.isClosed = true;
          election.endedAt = now.toISOString();
          changed = true;
        }
      }
    });

    if (changed) {
      localStorage.setItem('elections', JSON.stringify(localElections));
    }
  }

  autoCloseElections();
  localElections = JSON.parse(localStorage.getItem('elections') || '[]');

  // -------------------------------------------------------
  // 🔥 LOAD FIREBASE VOTES FOR EACH ELECTION
  // -------------------------------------------------------
  async function loadFirebaseVotes(election) {
    if (!election.firebaseId) return;

    try {
      const snapshot = await db
        .collection("polls")
        .doc(election.firebaseId)
        .collection("votes")
        .get();

      election.firebaseVotes = [];
      snapshot.forEach(doc => election.firebaseVotes.push(doc.data()));
    } catch (err) {
      console.warn("Firebase vote load failed:", err);
    }
  }

  // ---------------- HELPERS (UNCHANGED) ----------------
  function getVoteCounts(election) {
    const counts = new Array(election.candidates.length).fill(0);

    // Local votes
    if (Array.isArray(election.votes)) {
      election.votes.forEach(v => {
        if (v.candidateIndex >= 0 && v.candidateIndex < counts.length) {
          counts[v.candidateIndex]++;
        }
      });
    }

    // Firebase votes
    if (Array.isArray(election.firebaseVotes)) {
      election.firebaseVotes.forEach(v => {
        counts[v.candidateIndex]++;
      });
    }

    return counts;
  }

  function computeWinner(election) {
    const counts = getVoteCounts(election);
    const totalVotes = counts.reduce((sum, v) => sum + v, 0);

    if (totalVotes === 0) {
      return { totalVotes: 0, winners: [], maxVotes: 0 };
    }

    const maxVotes = Math.max(...counts);
    const winners = [];

    counts.forEach((v, idx) => {
      if (v === maxVotes) winners.push(idx);
    });

    return { totalVotes, winners, maxVotes };
  }

  // ----------------------------------------------------------------
  // RENDER ELECTION CARDS (LOCAL + FIREBASE)
  // ----------------------------------------------------------------
  async function renderMyElections() {
    myElectionsList.innerHTML = '';

    // localReload
    localElections = JSON.parse(localStorage.getItem('elections') || '[]');

    // merge again
    elections = [...firebaseElections, ...localElections];

    // Filter by owner
    const user = auth.currentUser;
    const myLocal = localElections.filter(e => e.ownerUsername === currentUser.username);
    const myFirebase = firebaseElections.filter(e => e.ownerUID === user?.uid);

    const myAll = [...myFirebase, ...myLocal];

    if (myAll.length === 0) {
      myElectionsList.innerHTML = '<p>You have not created any elections yet.</p>';
      return;
    }

    for (let election of myAll) {
      if (election.firebaseId) {
        await loadFirebaseVotes(election);
      }

      const card = document.createElement('div');
      card.className = 'election-card';
      card.style.textAlign = 'left';
      card.style.marginTop = '1.5rem';
      card.style.paddingTop = '1rem';
      card.style.borderTop = '1px solid #eee';

      const status = election.isClosed ? 'Closed' : 'Open';
      const winnerInfo = computeWinner(election);

      // Winner text (local behavior preserved)
      let winnerText = '';
      if (election.isClosed) {
        if (winnerInfo.totalVotes === 0) {
          winnerText = 'No votes were cast.';
        } else if (winnerInfo.winners.length === 1) {
          const winnerCandidate = election.candidates[winnerInfo.winners[0]];
          const name = winnerCandidate ? winnerCandidate.name : 'Unknown';
          winnerText = `Winner: ${name} (${winnerInfo.maxVotes} votes)`;
        } else {
          const names = winnerInfo.winners
            .map(i => election.candidates[i]?.name || 'Unknown')
            .join(', ');
          winnerText = `Tie between: ${names}`;
        }
      } else {
        winnerText = 'Election is still open.';
      }

      // Candidate list
      const voteCounts = getVoteCounts(election);
      let candidatesHtml = '';
      election.candidates.forEach((candidate, cIndex) => {
        candidatesHtml += `
          <div class="form-group">
            <strong>${candidate.name || 'Unnamed Candidate'}</strong>
            <div style="margin-left: 1.25rem; font-size: 0.9rem;">
              ${candidate.description || ''}
              ${candidate.imageUrl ? `<br><img src="${candidate.imageUrl}" style="max-width: 100%; max-height:150px;">` : ''}
              <br><span>Votes: ${voteCounts[cIndex]}</span>
            </div>
          </div>
        `;
      });

      card.innerHTML = `
        <h2>${election.title}</h2>
        <p>${election.description}</p>
        <p><strong>Status:</strong> ${status}</p>
        <p><strong>Visibility:</strong> ${election.visibility}</p>
        <p><strong>Access Code:</strong> ${election.accessCode}</p>
        <p><strong>Ends At:</strong> ${new Date(election.endAt).toLocaleString()}</p>
        <p><strong>Total Votes:</strong> ${winnerInfo.totalVotes}</p>
        <p><strong>Result:</strong> ${winnerText}</p>
        <h3>Candidates</h3>
        ${candidatesHtml}
      `;

      // END ELECTION BUTTON
      if (!election.isClosed) {
        const endButton = document.createElement('button');
        endButton.textContent = 'End Election';
        endButton.style.marginTop = '0.5rem';

        endButton.addEventListener('click', function() {
          endElection(election);
        });

        card.appendChild(endButton);
      }

      myElectionsList.appendChild(card);
    }
  }

  // ------------------------------------------------------------
  // 🔥 END ELECTION (LOCAL + FIREBASE)
  // ------------------------------------------------------------
  async function endElection(election) {
    myElectionsError.textContent = '';
    myElectionsSuccess.textContent = '';

    const winnerInfo = computeWinner(election);

    // LOCAL UPDATE
    let localAll = JSON.parse(localStorage.getItem('elections') || '[]');
    const idx = localAll.findIndex(e => e.id === election.id);
    if (idx !== -1) {
      localAll[idx].isClosed = true;
      localAll[idx].endedAt = new Date().toISOString();
      localAll[idx].resultSummary = winnerInfo;
      localStorage.setItem('elections', JSON.stringify(localAll));
    }

    // FIREBASE UPDATE
    if (election.firebaseId) {
      try {
        await db.collection("polls")
          .doc(election.firebaseId)
          .update({
            isClosed: true,
            endedAt: new Date().toISOString(),
            resultSummary: winnerInfo
          });
        console.log("Election ended in Firebase.");
      } catch (err) {
        console.warn("Firebase end election failed:", err);
      }
    }

    myElectionsSuccess.textContent = "Election ended successfully.";
    renderMyElections();
  }

  // Initial render
  renderMyElections();

});
