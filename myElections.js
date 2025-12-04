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
      let data = docSnap.data();
      data.id = docSnap.id;  // include ID for Firestore updates
      myElections.push(data);
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

    if (totalVotes === 0) return { totalVotes: 0, winners: [], maxVotes: 0 };

    const maxVotes = Math.max(...counts);
    const winners = counts
      .map((count, idx) => count === maxVotes ? idx : null)
      .filter(idx => idx !== null);

    return { totalVotes, winners, maxVotes };
  }

  async function renderMyElections() {
    myElectionsList.innerHTML = '';

    for (const election of myElections) {
      const votes = await loadVotes(election.id);
      const winnerInfo = computeWinner(election, votes);

      const card = document.createElement('div');
      card.className = 'election-card';
      card.style.marginTop = '1.5rem';

      const status = election.isClosed ? 'Closed' : 'Open';

      let winnerText = election.isClosed
        ? winnerInfo.totalVotes === 0
            ? 'No votes were cast. No winner.'
            : winnerInfo.winners.length === 1
                ? `Winner: ${election.candidates[winnerInfo.winners[0]].name}`
                : `Tie between: ${winnerInfo.winners.map(i => election.candidates[i].name).join(', ')}`
        : 'Election is still open. End the election to finalize results.';

      // Build candidates list
      let candidatesHtml = election.candidates.map((c, i) => {
        const votesForThis = getVoteCounts(election, votes)[i] || 0;
        return `
          <div>
            <strong>${c.name}</strong> - Votes: ${votesForThis}
          </div>`;
      }).join("");

      card.innerHTML = `
        <h2>${election.title}</h2>
        <p>${election.description || ""}</p>
        <p><strong>Status:</strong> ${status}</p>
        <p><strong>Visibility:</strong> ${election.visibility || "Public"}</p>
        ${election.accessCode ? `<p><strong>Access Code:</strong> ${election.accessCode}</p>` : ""}
        ${election.endAt ? `<p><strong>Ends At:</strong> ${new Date(election.endAt).toLocaleString()}</p>` : ""}
        <p><strong>Total Votes:</strong> ${winnerInfo.totalVotes}</p>
        <p><strong>Result:</strong> ${winnerText}</p>
        <h3>Candidates</h3>
        ${candidatesHtml}
      `;

      // ----- BUTTON LOGIC -----

      if (!election.isClosed) {
        const endButton = document.createElement('button');
        endButton.textContent = 'End Election';
        endButton.style.marginTop = '0.5rem';
        endButton.onclick = () => endElection(election.id);
        card.appendChild(endButton);

      } else {
        const openButton = document.createElement('button');
        openButton.textContent = 'Re-Open Election';
        openButton.style.marginTop = '0.5rem';
        openButton.onclick = () => openElection(election.id);
        card.appendChild(openButton);
      }

      myElectionsList.appendChild(card);
    }
  }

  // ----- CLOSE ELECTION -----
  async function endElection(electionId) {
    const elecDoc = await getDoc(doc(db, "polls", electionId));
    if (!elecDoc.exists()) return alert("Election not found.");

    const election = elecDoc.data();
    const votes = await loadVotes(electionId);
    const winnerInfo = computeWinner(election, votes);

    await updateDoc(doc(db, "polls", electionId), {
      isClosed: true,
      endedAt: new Date().toISOString(),
      resultSummary: winnerInfo
    });

    loadMyElections();
  }

  // ----- OPEN ELECTION -----
  async function openElection(electionId) {
    await updateDoc(doc(db, "polls", electionId), { isClosed: false });
    loadMyElections();
  }

  loadMyElections();
});
