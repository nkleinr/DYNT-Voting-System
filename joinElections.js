import { auth, db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  addDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', function() {
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

  let elections = [];

  async function loadPublicElections() {
    elections = [];
    const q = query(collection(db, "polls"), where("visibility", "==", "public"));
    const snap = await getDocs(q);
    snap.forEach(docSnap => {
      elections.push(docSnap.data());
    });
    renderPublic();
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

  async function loadVotes(electionId) {
    const voteSnap = await getDocs(collection(db, "polls", electionId, "votes"));
    const votes = [];
    voteSnap.forEach(v => votes.push(v.data()));
    return votes;
  }

  function userHasVoted(votes, username) {
    return votes.some(v => v.username === username);
  }

  function renderElectionCard(election, votes) {
    let card = document.getElementById(`election-${election.id}`);
    if (card) return card;

    const voteCounts = getVoteCounts(election, votes);
    const hasVoted = userHasVoted(votes, currentUser.username);
    const isClosed = !!election.isClosed;

    card = document.createElement('div');
    card.className = 'election-card';
    card.id = `election-${election.id}`;
    card.style.textAlign = 'left';
    card.style.marginTop = '1.5rem';
    card.style.paddingTop = '1rem';
    card.style.borderTop = '1px solid #eee';

    let candidatesHtml = '';
    election.candidates.forEach((candidate, cIndex) => {
      const votesForThis = voteCounts[cIndex] || 0;
      candidatesHtml += `
        <div class="form-group">
          <label>
            <input type="radio" name="candidate-${election.id}" value="${cIndex}">
            <strong>${candidate.name || 'Unnamed Candidate'}</strong>
          </label>
          <div style="margin-left: 1.25rem; font-size: 0.9rem;">
            ${candidate.description ? candidate.description : ''}
            ${candidate.imageUrl ? `<br><img src="${candidate.imageUrl}" alt="Candidate image" style="max-width: 100%; max-height: 150px; margin-top: 0.25rem;">` : ''}
            <br><span>Votes: ${votesForThis}</span>
          </div>
        </div>
      `;
    });

    const status = election.isClosed ? 'Closed' : 'Open';

    card.innerHTML = `
      <h2>${election.title}</h2>
      <p>${election.description}</p>
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Created by:</strong> ${election.ownerUsername}</p>
      <p><strong>Visibility:</strong> ${election.visibility === 'public' ? 'Public' : 'Private'}</p>
      <p><strong>Minimum Age:</strong> ${election.minAge}</p>
      ${election.accessCode ? `<p><strong>Access Code:</strong> ${election.accessCode}</p>` : ''}
      ${election.endAt ? `<p><strong>Ends At:</strong> ${new Date(election.endAt).toLocaleString()}</p>` : ''}
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

    voteButton.addEventListener('click', async function() {
      if (voteButton.disabled) return;
      await handleVote(election.id, card, voteButton);
    });

    card.appendChild(voteButton);
    electionsList.appendChild(card);

    return card;
  }

  async function handleVote(electionId, cardElement, voteButton) {
    joinError.textContent = '';
    joinSuccess.textContent = '';

    const elecDoc = await getDoc(doc(db, "polls", electionId));
    if (!elecDoc.exists()) {
      joinError.textContent = 'Election not found.';
      return;
    }
    const election = elecDoc.data();

    if (election.isClosed) {
      joinError.textContent = 'This election has ended. You can no longer vote.';
      voteButton.disabled = true;
      voteButton.textContent = 'Election Closed';
      return;
    }

    if (typeof currentUser.age === 'number') {
      if (currentUser.age < election.minAge) {
        joinError.textContent = `You must be at least ${election.minAge} to vote in this election.`;
        return;
      }
    } else {
      joinError.textContent = 'Your account is missing a valid age. Update your profile first.';
      return;
    }

    if (election.visibility === 'private') {
      if (election.ownerUsername !== currentUser.username) {
        joinError.textContent = 'This is a private election. Only the owner can vote at this time.';
        return;
      }
    }

    const votes = await loadVotes(electionId);
    if (userHasVoted(votes, currentUser.username)) {
      joinError.textContent = 'You have already voted in this election.';
      voteButton.disabled = true;
      voteButton.textContent = 'Already Voted';
      return;
    }

    const radioName = `candidate-${electionId}`;
    const selectedRadio = cardElement.querySelector(`input[name="${radioName}"]:checked`);
    if (!selectedRadio) {
      joinError.textContent = 'Please select a candidate before voting.';
      return;
    }

    const candidateIndex = parseInt(selectedRadio.value, 10);
    if (
      Number.isNaN(candidateIndex) ||
      candidateIndex < 0 ||
      candidateIndex >= election.candidates.length
    ) {
      joinError.textContent = 'Invalid candidate selection.';
      return;
    }

    const voteRef = doc(collection(db, "polls", electionId, "votes"), currentUser.username);
    await setDoc(voteRef, {
      username: currentUser.username,
      candidateIndex: candidateIndex,
      votedAt: new Date().toISOString()
    });

    joinSuccess.textContent = 'Your vote has been recorded successfully!';
    voteButton.disabled = true;
    voteButton.textContent = 'Already Voted';

    setTimeout(() => {
      window.location.reload();
    }, 800);
  }

  async function renderPublic() {
    electionsList.innerHTML = '';
    for (const election of elections) {
      const votes = await loadVotes(election.id);
      renderElectionCard(election, votes);
    }
  }

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

    const q = query(collection(db, "polls"), where("accessCode", "==", code));
    const snap = await getDocs(q);

    if (snap.empty) {
      codeError.textContent = 'No election found for that code.';
      return;
    }

    const election = snap.docs[0].data();
    const votes = await loadVotes(election.id);

    const card = renderElectionCard(election, votes);

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.transition = 'background-color 0.5s';
    card.style.backgroundColor = '#e8f0fe';
    setTimeout(() => {
      card.style.backgroundColor = 'white';
    }, 1200);
  }

  codeGoButton.addEventListener('click', handleCodeSearch);

  codeInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCodeSearch();
    }
  });

  loadPublicElections();
});
