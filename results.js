import { auth, db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', function() {

  let currentUser = JSON.parse(localStorage.getItem('currentUser'));

  onAuthStateChanged(auth, function(user) {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    if (!currentUser) {
      currentUser = { username: user.email || user.uid };
    }
  });

  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }

  const resultsList = document.getElementById('resultsList');
  const resultsError = document.getElementById('resultsError');
  const resultsSuccess = document.getElementById('resultsSuccess');

  let elections = [];

  async function loadAllElections() {
    const snap = await getDocs(collection(db, "polls"));
    elections = [];
    snap.forEach(docSnap => elections.push(docSnap.data()));
  }

  async function loadElectionById(id) {
    const ref = doc(db, "polls", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
  }

  async function loadVotes(electionId) {
    const voteSnap = await getDocs(collection(db, "polls", electionId, "votes"));
    const votes = [];
    voteSnap.forEach(v => votes.push(v.data()));
    return votes;
  }

  function getVoteCounts(election, votes) {
    const counts = new Array(election.candidates.length).fill(0);
    votes.forEach(v => {
      if (
        typeof v.candidateIndex === 'number' &&
        v.candidateIndex >= 0 &&
        v.candidateIndex < counts.length
      ) {
        counts[v.candidateIndex]++;
      }
    });
    return counts;
  }

  function computeWinner(election, votes) {
    const counts = getVoteCounts(election, votes);
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
      winners,
      maxVotes
    };
  }

  function getUserVoteIndex(votes, username) {
    const vote = votes.find(v => v.username === username);
    return vote ? vote.candidateIndex : null;
  }

  async function renderElection(election) {
    const votes = await loadVotes(election.id);
    const winnerInfo = computeWinner(election, votes);
    const totalVotes = winnerInfo.totalVotes;
    const voteCounts = getVoteCounts(election, votes);
    const yourVoteIndex = getUserVoteIndex(votes, currentUser.username);

    const card = document.createElement('div');
    card.className = 'election-card';
    card.style.textAlign = 'left';
    card.style.marginTop = '1.5rem';
    card.style.paddingTop = '1rem';
    card.style.borderTop = '1px solid #eee';

    const status = election.isClosed ? 'Closed' : 'Open';

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

  async function main() {
    const params = new URLSearchParams(window.location.search);
    const electionIdParam = params.get('id');

    if (electionIdParam) {
      const election = await loadElectionById(electionIdParam);
      if (!election) {
        resultsList.innerHTML = '<p>No election found for that link.</p>';
        return;
      }
      await renderElection(election);
      return;
    }

    await loadAllElections();

    if (elections.length === 0) {
      resultsList.innerHTML = '<p>No elections exist yet.</p>';
      return;
    }

    for (const election of elections) {
      await renderElection(election);
    }
  }

  main();
});
