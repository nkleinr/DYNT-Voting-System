document.addEventListener('DOMContentLoaded', async function() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));

  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }

  const resultsList = document.getElementById('resultsList');
  const resultsError = document.getElementById('resultsError');
  const resultsSuccess = document.getElementById('resultsSuccess');

  // Load Firebase elections
  let firebaseElections = [];
  try {
    const snapshot = await db.collection("polls").get();
    snapshot.forEach(doc => {
      firebaseElections.push({
        firebaseId: doc.id,
        ...doc.data()
      });
    });
  } catch (err) {}

  // Load local elections
  let elections = JSON.parse(localStorage.getItem('elections') || '[]');

  if (firebaseElections.length === 0 && elections.length === 0) {
    resultsList.innerHTML = '<p>No elections exist yet.</p>';
    return;
  }

  elections = [...firebaseElections, ...elections];

  // Read ?id=... from the URL (if present)
  const params = new URLSearchParams(window.location.search);
  const electionIdParam = params.get('id');

  // ---------- Helper functions ----------

  // Count votes per candidate
  function getVoteCounts(election) {
    const counts = new Array(election.candidates.length).fill(0);

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

    if (Array.isArray(election.firebaseVotes)) {
      election.firebaseVotes.forEach(v => {
        if (
          typeof v.candidateIndex === 'number' &&
          v.candidateIndex >= 0 &&
          v.candidateIndex < counts.length
        ) {
          counts[v.candidateIndex]++;
        }
      });
    }

    return counts;
  }

  // Compute winner info
  function computeWinner(election) {
    const counts = getVoteCounts(election);
    const totalVotes = counts.reduce((sum, c) => sum + c, 0);

    if (totalVotes === 0) {
      return {
        totalVotes: 0,
        winners: [],
        maxVotes: 0
      };
    }

    const maxVotes = Math.max(...counts);
    const winners = [];

    counts.forEach((count, idx) => {
      if (count === maxVotes) {
        winners.push(idx);
      }
    });

    return {
      totalVotes,
      winners,   // array of candidate indexes
      maxVotes
    };
  }

  // Which candidate did the current user vote for?
  function getUserVoteIndex(election) {
    if (Array.isArray(election.votes)) {
      const vote = election.votes.find(v => v.username === currentUser.username);
      if (vote) return vote.candidateIndex;
    }

    if (Array.isArray(election.firebaseVotes)) {
      const vote = election.firebaseVotes.find(v => v.uid === auth.currentUser?.uid);
      if (vote) return vote.candidateIndex;
    }

    return null;
  }

  //  Load Firebase votes into election object
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
    } catch (err) {}
  }

  //  Auto-close elections whose end time has passed and "export" results
  function autoCloseElections() {
    let changed = false;
    const now = new Date();

    elections.forEach(election => {
      if (!election.isClosed && election.endAt) {
        const endTime = new Date(election.endAt);
        if (!isNaN(endTime.getTime()) && now >= endTime) {
          // Close and compute winner
          const winnerInfo = computeWinner(election);
          election.isClosed = true;
          election.endedAt = now.toISOString();
          election.resultSummary = winnerInfo; // this is the "exported" result
          changed = true;
        }
      }
    });

    if (changed) {
      localStorage.setItem('elections', JSON.stringify(elections));
    }
  }

  // Run auto-close before rendering
  autoCloseElections();

  // ---------- Decide what to show ----------

  let filteredElections;

  if (electionIdParam) {
    filteredElections = elections.filter(election =>
      String(election.id) === String(electionIdParam) ||
      String(election.firebaseId) === String(electionIdParam)
    );

    if (filteredElections.length === 0) {
      resultsList.innerHTML = '<p>No election found for that link.</p>';
      return;
    }
  } else {
    filteredElections = elections;
  }

  // ---------- Render results ----------

  for (let election of filteredElections) {
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
    const totalVotes = winnerInfo.totalVotes;
    const voteCounts = getVoteCounts(election);
    const yourVoteIndex = getUserVoteIndex(election);

    let resultText = '';
    if (!election.isClosed) {
      resultText = 'Election is still open. Results may change.';
    } else if (totalVotes === 0) {
      resultText = 'Election ended. No votes were cast.';
    } else if (winnerInfo.winners.length === 1) {
      const winnerCandidate = election.candidates[winnerInfo.winners[0]];
      const name = winnerCandidate ? winnerCandidate.name : 'Unknown Candidate';
      resultText = `Winner: ${name} with ${winnerInfo.maxVotes} vote(s).`;
    } else {
      const names = winnerInfo.winners
        .map(idx => election.candidates[idx] ? election.candidates[idx].name : 'Unknown')
        .join(', ');
      resultText = `Tie between: ${names} with ${winnerInfo.maxVotes} vote(s) each.`;
    }

    let candidatesHtml = '';
    election.candidates.forEach((candidate, cIndex) => {
      const votesForThis = voteCounts[cIndex] || 0;
      const isYourVote = (yourVoteIndex === cIndex);

      candidatesHtml += `
        <div class="form-group">
          <strong>${candidate.name || 'Unnamed Candidate'}</strong>
          ${isYourVote ? ` <span style="color: #007bff; font-weight: normal;">(Your vote)</span>` : ''}
          <div style="margin-left: 1.25rem; font-size: 0.9rem;">
            ${candidate.description ? candidate.description : ''}
            ${candidate.imageUrl ? `<br><img src="${candidate.imageUrl}" alt="Candidate image" style="max-width: 100%; max-height: 150px; margin-top: 0.25rem;">` : ''}
            <br><span>Votes: ${votesForThis}</span>
          </div>
        </div>
      `;
    });

    card.innerHTML = `
      <h2>${election.title}</h2>
      <p>${election.description}</p>
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Created by:</strong> ${election.ownerUsername}</p>
      <p><strong>Visibility:</strong> ${election.visibility === 'public' ? 'Public' : 'Private'}</p>
      ${election.accessCode ? `<p><strong>Access Code:</strong> ${election.accessCode}</p>` : ''}
      ${election.endAt ? `<p><strong>Ends At:</strong> ${new Date(election.endAt).toLocaleString()}</p>` : ''}
      <p><strong>Total Votes:</strong> ${totalVotes}</p>
      <p><strong>Result:</strong> ${resultText}</p>
      <h3>Candidates</h3>
      ${candidatesHtml}
    `;

    resultsList.appendChild(card);
  }
});
