import { auth, db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc
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

  const myElectionsList = document.getElementById('myElectionsList');
  const myElectionsError = document.getElementById('myElectionsError');
  const myElectionsSuccess = document.getElementById('myElectionsSuccess');

  let myElections = [];

  async function loadMyElections() {
    myElectionsList.innerHTML = '';

    const q = query(collection(db, "polls"), where("ownerUsername", "==", currentUser.username));
    const snap = await getDocs(q);

    myElections = [];
    snap.forEach(docSnap => {
      myElections.push(docSnap.data());
    });

    if (myElections.length === 0) {
      myElectionsList.innerHTML = '<p>You have not created any elections yet.</p>';
      return;
    }

    renderMyElections();
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
      if (v.candidateIndex >= 0 && v.candidateIndex < counts.length) {
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

    let maxVotes = Math.max(...counts);
    let winnerIndexes = [];

    counts.forEach((count, idx) => {
      if (count === maxVotes) {
        winnerIndexes.push(idx);
      }
    });

    return {
      totalVotes: totalVotes,
      winners: winnerIndexes,
      maxVotes: maxVotes
    };
  }

  async function renderMyElections() {
    myElectionsList.innerHTML = '';

    for (const election of myElections) {
      const votes = await loadVotes(election.id);
      const winnerInfo = computeWinner(election, votes);

      const card = document.createElement('div');
      card.className = 'election-card';
      card.style.textAlign = 'left';
      card.style.marginTop = '1.5rem';
      card.style.paddingTop = '1rem';
      card.style.borderTop = '1px solid #eee';

      const status = election.isClosed ? 'Closed' : 'Open';

      let winnerText = '';
      if (election.isClosed) {
        if (winnerInfo.totalVotes === 0) {
          winnerText = 'No votes were cast. No winner.';
        } else if (winnerInfo.winners.length === 1) {
          const winnerCandidate = election.candidates[winnerInfo.winners[0]];
          const name = winnerCandidate ? winnerCandidate.name : 'Unknown Candidate';
          winnerText = `Winner: ${name} with ${winnerInfo.maxVotes} vote(s).`;
        } else {
          const names = winnerInfo.winners.map(idx => {
            const c = election.candidates[idx];
            return c ? c.name : 'Unknown';
          }).join(', ');
          winnerText = `Tie between: ${names} with ${winnerInfo.maxVotes} vote(s) each.`;
        }
      } else {
        winnerText = 'Election is still open. End the election to finalize results.';
      }

      const counts = getVoteCounts(election, votes);
      let candidatesHtml = '';
      election.candidates.forEach((candidate, cIndex) => {
        const votesForThis = counts[cIndex] || 0;
        candidatesHtml += `
          <div class="form-group">
            <strong>${candidate.name || 'Unnamed Candidate'}</strong>
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
        <p><strong>Visibility:</strong> ${election.visibility === 'public' ? 'Public' : 'Private'}</p>
        ${election.accessCode ? `<p><strong>Access Code:</strong> ${election.accessCode}</p>` : ''}
        ${election.endAt ? `<p><strong>Ends At:</strong> ${new Date(election.endAt).toLocaleString()}</p>` : ''}
        <p><strong>Minimum Age:</strong> ${election.minAge}</p>
        <p><strong>Total Votes:</strong> ${winnerInfo.totalVotes}</p>
        <p><strong>Result:</strong> ${winnerText}</p>
        <h3>Candidates</h3>
        ${candidatesHtml}
      `;

      if (!election.isClosed) {
        const endButton = document.createElement('button');
        endButton.textContent = 'End Election';
        endButton.style.marginTop = '0.5rem';

        endButton.addEventListener('click', function() {
          endElection(election.id);
        });

        card.appendChild(endButton);
      }

      myElectionsList.appendChild(card);
    }
  }

  async function endElection(electionId) {
    myElectionsError.textContent = '';
    myElectionsSuccess.textContent = '';

    const elecDoc = await getDoc(doc(db, "polls", electionId));
    if (!elecDoc.exists()) {
      myElectionsError.textContent = 'Election not found or you are not the owner.';
      return;
    }

    const election = elecDoc.data();
    if (election.ownerUsername !== currentUser.username) {
      myElectionsError.textContent = 'Election not found or you are not the owner.';
      return;
    }

    if (election.isClosed) {
      myElectionsError.textContent = 'This election is already closed.';
      return;
    }

    const votes = await loadVotes(electionId);
    const winnerInfo = computeWinner(election, votes);

    await updateDoc(doc(db, "polls", electionId), {
      isClosed: true,
      endedAt: new Date().toISOString(),
      resultSummary: {
        totalVotes: winnerInfo.totalVotes,
        winners: winnerInfo.winners,
        maxVotes: winnerInfo.maxVotes
      }
    });

    if (winnerInfo.totalVotes === 0) {
      myElectionsSuccess.textContent = 'Election ended. No votes were cast.';
    } else if (winnerInfo.winners.length === 1) {
      const winnerCandidate = election.candidates[winnerInfo.winners[0]];
      const name = winnerCandidate ? winnerCandidate.name : 'Unknown Candidate';
      myElectionsSuccess.textContent = `Election ended. Winner: ${name} with ${winnerInfo.maxVotes} vote(s).`;
    } else {
      const names = winnerInfo.winners.map(idx => {
        const c = election.candidates[idx];
        return c ? c.name : 'Unknown';
      }).join(', ');
      myElectionsSuccess.textContent = `Election ended. It's a tie between: ${names} with ${winnerInfo.maxVotes} vote(s) each.`;
    }

    loadMyElections();
  }

  loadMyElections();
});
