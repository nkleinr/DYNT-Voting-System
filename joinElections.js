document.addEventListener('DOMContentLoaded', async function() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));

  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }

  const electionsList = document.getElementById('electionsList');
  const joinError = document.getElementById('joinError');
  const joinSuccess = document.getElementById('joinSuccess');
  const codeError = document.getElementById('codeError');
  const codeInput = document.getElementById('codeInput');
  const codeGoButton = document.getElementById('codeGoButton');

  // -------------------------------------------------------
  // 🔥 FIREBASE: LOAD ELECTIONS FROM FIRESTORE
  // -------------------------------------------------------
  let firebaseElections = [];
  try {
    const snapshot = await db.collection("polls").get();
    snapshot.forEach((doc) => {
      firebaseElections.push({
        firebaseId: doc.id,
        ...doc.data()
      });
    });
    console.log("Loaded Firebase elections:", firebaseElections);
  } catch (err) {
    console.warn("Could not load from Firebase. Using localStorage only.", err);
  }

  // -------------------------------------------------------
  // ORIGINAL LOCAL STORAGE ELECTIONS
  // -------------------------------------------------------
  let localElections = JSON.parse(localStorage.getItem('elections') || '[]');

  // -------------------------------------------------------
  // 🔥 COMBINE BOTH DATA SOURCES (Firebase + Local)
  // -------------------------------------------------------
  let elections = [...firebaseElections, ...localElections];

  // -------------------------------------------------------
  // CLOSE ELECTIONS THAT REACHED END TIME (LOCAL ONLY)
  // -------------------------------------------------------
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

  // ----------------------------------------------------
  // ORIGINAL FUNCTIONS BELOW (unchanged)
  // ----------------------------------------------------

  function getVoteCounts(election) {
    const counts = new Array(election.candidates.length).fill(0);

    // Local votes
    if (Array.isArray(election.votes)) {
      election.votes.forEach(v => {
        if (
          typeof v.candidateIndex === 'number' &&
          v.candidateIndex >= 0 &&
          v.candidateIndex < counts.length
        ) {
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

  function userHasVoted(election) {
    if (Array.isArray(election.votes)) {
      if (election.votes.some(v => v.username === currentUser.username)) {
        return true;
      }
    }

    if (Array.isArray(election.firebaseVotes)) {
      if (election.firebaseVotes.some(v => v.uid === auth.currentUser?.uid)) {
        return true;
      }
    }

    return false;
  }

  async function loadFirebaseVotes(election) {
    if (!election.firebaseId) return;

    try {
      const snapshot = await db
        .collection("polls")
        .doc(election.firebaseId)
        .collection("votes")
        .get();

      election.firebaseVotes = [];
      snapshot.forEach(doc => {
        election.firebaseVotes.push(doc.data());
      });
    } catch (err) {
      console.warn("Could not load Firebase votes:", err);
    }
  }

  // RENDER EACH ELECTION
  async function renderElectionCard(election) {
    if (election.firebaseId) {
      await loadFirebaseVotes(election);
    }

    let card = document.getElementById(`election-${election.id || election.firebaseId}`);
    if (card) return card;

    const cardId = election.id || election.firebaseId;

    card = document.createElement('div');
    card.className = 'election-card';
    card.id = `election-${cardId}`;
    card.style.textAlign = 'left';
    card.style.marginTop = '1.5rem';
    card.style.paddingTop = '1rem';
    card.style.borderTop = '1px solid #eee';

    const status = election.isClosed ? 'Closed' : 'Open';
    const voteCounts = getVoteCounts(election);
    const hasVoted = userHasVoted(election);
    const isClosed = !!election.isClosed;

    let candidatesHtml = '';
    election.candidates.forEach((candidate, cIndex) => {
      const votesForThis = voteCounts[cIndex] || 0;
      candidatesHtml += `
        <div class="form-group">
          <label>
            <input type="radio" name="candidate-${cardId}" value="${cIndex}">
            <strong>${candidate.name || 'Unnamed Candidate'}</strong>
          </label>
          <div style="margin-left: 1.25rem; font-size: 0.9rem;">
            ${candidate.description || ''}
            ${candidate.imageUrl ? `<br><img src="${candidate.imageUrl}" style="max-width: 100%; max-height: 150px;">` : ''}
            <br><span>Votes: ${votesForThis}</span>
          </div>
        </div>
      `;
    });

    card.innerHTML = `
      <h2>${election.title}</h2>
      <p>${election.description}</p>
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Created by:</strong> ${election.ownerUsername || 'Unknown'}</p>
      <p><strong>Visibility:</strong> ${election.visibility}</p>
      <p><strong>Minimum Age:</strong> ${election.minAge}</p>
      <p><strong>Access Code:</strong> ${election.accessCode}</p>
      <p><strong>Ends At:</strong> ${new Date(election.endAt).toLocaleString()}</p>
      <h3>Candidates</h3>
      ${candidatesHtml}
    `;

    const voteButton = document.createElement('button');
    voteButton.textContent = 'Vote';
    voteButton.style.marginTop = '0.5rem';

    if (isClosed) {
      voteButton.disabled = true;
      voteButton.textContent = 'Election Closed';
    } else if (hasVoted) {
      voteButton.disabled = true;
      voteButton.textContent = 'Already Voted';
    }

    voteButton.addEventListener('click', function() {
      if (!voteButton.disabled) {
        handleVote(election, card, voteButton);
      }
    });

    card.appendChild(voteButton);
    electionsList.appendChild(card);

    return card;
  }

  // -------------------------------------------------------
  // 🔥 FIREBASE + LOCALSTORAGE VOTING
  // -------------------------------------------------------
  async function handleVote(election, cardElement, voteButton) {
    joinError.textContent = '';
    joinSuccess.textContent = '';

    if (election.isClosed) {
      joinError.textContent = 'This election has ended.';
      return;
    }

    if (currentUser.age < election.minAge) {
      joinError.textContent = `You must be at least ${election.minAge} to vote.`;
      return;
    }

    if (userHasVoted(election)) {
      joinError.textContent = 'You already voted.';
      return;
    }

    const radioName = `candidate-${election.id || election.firebaseId}`;
    const selectedRadio = cardElement.querySelector(
      `input[name="${radioName}"]:checked`
    );

    if (!selectedRadio) {
      joinError.textContent = 'Select a candidate first.';
      return;
    }

    const candidateIndex = parseInt(selectedRadio.value, 10);

    // ----------------------------------------------------
    // 🔥 FIREBASE VOTE SAVE
    // ----------------------------------------------------
    if (election.firebaseId) {
      try {
        await db.collection("polls")
          .doc(election.firebaseId)
          .collection("votes")
          .doc(auth.currentUser.uid)
          .set({
            uid: auth.currentUser.uid,
            candidateIndex: candidateIndex,
            votedAt: new Date().toISOString()
          });

        console.log("Vote saved to Firebase.");
      } catch (err) {
        console.warn("Firebase vote save failed:", err);
      }
    }

    // ----------------------------------------------------
    // LOCAL BACKUP
    // ----------------------------------------------------
    const allLocal = JSON.parse(localStorage.getItem('elections') || '[]');
    const idx = allLocal.findIndex(e => e.id === election.id);
    if (idx !== -1) {
      if (!Array.isArray(allLocal[idx].votes)) {
        allLocal[idx].votes = [];
      }
      allLocal[idx].votes.push({
        username: currentUser.username,
        candidateIndex: candidateIndex,
        votedAt: new Date().toISOString()
      });

      localStorage.setItem('elections', JSON.stringify(allLocal));
    }

    joinSuccess.textContent = 'Your vote has been recorded!';
    voteButton.disabled = true;
    voteButton.textContent = 'Already Voted';

    setTimeout(() => window.location.reload(), 800);
  }

  // -------------------------------------------------------
  // RENDER INITIAL PUBLIC ELECTIONS
  // -------------------------------------------------------
  const publicElections = elections.filter(e => e.visibility === 'public');
  if (publicElections.length === 0) {
    electionsList.innerHTML = '<p>No public elections available.</p>';
  } else {
    for (let e of publicElections) {
      await renderElectionCard(e);
    }
  }

  // -------------------------------------------------------
  // 🔥 JOIN BY CODE (Firebase + Local)
  // -------------------------------------------------------
  async function handleCodeSearch() {
    codeError.textContent = '';
    joinError.textContent = '';
    joinSuccess.textContent = '';

    const rawCode = codeInput.value.trim();
    if (!rawCode) {
      codeError.textContent = 'Please enter a code.';
      return;
    }
    const code = rawCode.toUpperCase();

    // 1. Try Firebase match
    let match = firebaseElections.find(
      e => e.accessCode && e.accessCode.toUpperCase() === code
    );

    // 2. Fall back to localStorage
    if (!match) {
      match = localElections.find(
        e => e.accessCode && e.accessCode.toUpperCase() === code
      );
    }

    if (!match) {
      codeError.textContent = 'No election found for that code.';
      return;
    }

    const card = await renderElectionCard(match);

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.transition = 'background-color 0.5s';
    card.style.backgroundColor = '#e8f0fe';
    setTimeout(() => { card.style.backgroundColor = 'white'; }, 1200);
  }

  codeGoButton.addEventListener('click', handleCodeSearch);
  codeInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCodeSearch();
    }
  });

});
