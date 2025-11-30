document.addEventListener('DOMContentLoaded', function() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));

  // Require login
  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }

  const electionForm = document.getElementById('electionForm');
  const candidatesContainer = document.getElementById('candidatesContainer');
  const addCandidateButton = document.getElementById('addCandidateButton');
  const successMessage = document.getElementById('electionSuccess');

  // Helper: create a candidate block
  function addCandidate() {
    const index = candidatesContainer.children.length + 1;

    const candidateDiv = document.createElement('div');
    candidateDiv.className = 'candidate';
    candidateDiv.style.marginBottom = '1rem';
    candidateDiv.style.padding = '0.75rem 0';
    candidateDiv.style.borderTop = '1px solid #eee';

    candidateDiv.innerHTML = `
      <h3>Candidate ${index}</h3>
      <div class="form-group">
        <label>Candidate Name:</label>
        <input type="text" class="candidate-name" required>
      </div>
      <div class="form-group">
        <label>Candidate Description:</label>
        <textarea class="candidate-description" rows="2"></textarea>
      </div>
      <div class="form-group">
        <label>Candidate Image URL:</label>
        <input type="text" class="candidate-image" placeholder="https://example.com/image.jpg">
      </div>
    `;

    candidatesContainer.appendChild(candidateDiv);
  }

  // Start with 1 candidate
  addCandidate();

  addCandidateButton.addEventListener('click', function() {
    addCandidate();
  });

  // Helper: generate a random code for public elections
  function generateAccessCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      code += chars[randomIndex];
    }
    return code;
  }

  electionForm.addEventListener('submit', function(event) {
    event.preventDefault();
    successMessage.textContent = '';

    const title = document.getElementById('electionTitle').value.trim();
    const description = document.getElementById('electionDescription').value.trim();
    const minAgeValue = document.getElementById('minAge').value;
    const minAge = parseInt(minAgeValue, 10);

    const visibilityRadio = document.querySelector('input[name="visibility"]:checked');
    const visibility = visibilityRadio ? visibilityRadio.value : 'public';

    if (!title || !description || isNaN(minAge)) {
      alert('Please fill in all required fields.');
      return;
    }

    if (minAge < 0) {
      alert('Minimum age cannot be negative.');
      return;
    }

    const endDateTimeValue = document.getElementById('endDateTime').value;

    if (!endDateTimeValue) {
      alert('Please choose an end date and time.');
      return;
    }

    const endDate = new Date(endDateTimeValue);
    if (isNaN(endDate.getTime())) {
      alert('Invalid end date/time.');
      return;
    }

    const now = new Date();
    if (endDate <= now) {
      alert('End time must be in the future.');
      return;
    }

    // Gather candidates
    const candidateDivs = candidatesContainer.querySelectorAll('.candidate');
    const candidates = [];

    candidateDivs.forEach((div) => {
      const nameInput = div.querySelector('.candidate-name');
      const descInput = div.querySelector('.candidate-description');
      const imgInput = div.querySelector('.candidate-image');

      const name = nameInput.value.trim();
      const desc = descInput.value.trim();
      const imgUrl = imgInput.value.trim();

      if (name) {
        candidates.push({
          name: name,
          description: desc,
          imageUrl: imgUrl
        });
      }
    });

    if (candidates.length === 0) {
      alert('Please add at least one candidate with a name.');
      return;
    }

    // Generate access code
    let accessCode = generateAccessCode();

    // Build election object (LOCAL)
    const newElection = {
      id: Date.now(),
      ownerUsername: currentUser.username,
      title: title,
      description: description,
      visibility: visibility,
      accessCode: accessCode,
      minAge: minAge,
      candidates: candidates,
      createdAt: new Date().toISOString(),
      endAt: endDate.toISOString()
    };

    // ---------------------------------------------------------
    //  FIREBASE SAVE (localStorage still used)
    // ---------------------------------------------------------
    auth.onAuthStateChanged(function(user) {
      if (user) {
        db.collection("polls").add({
          ownerUID: user.uid,
          ownerUsername: currentUser.username,
          title: title,
          description: description,
          visibility: visibility,
          accessCode: accessCode,
          minAge: minAge,
          candidates: candidates,
          createdAt: new Date().toISOString(),
          endAt: endDate.toISOString()
        }).then(() => {
          console.log("Election saved to Firebase.");
        }).catch(err => {
          console.error("Firebase save error:", err);
        });
      } else {
        console.warn("No Firebase user logged in — saving ONLY to localStorage.");
      }
    });

    // ---------------------------------------------------------
    //  ALWAYS SAVE TO LOCALSTORAGE
    // ---------------------------------------------------------
    const existingElections = JSON.parse(localStorage.getItem('elections') || '[]');
    existingElections.push(newElection);
    localStorage.setItem('elections', JSON.stringify(existingElections));

    // Show success message
    if (accessCode) {
      successMessage.textContent = `Election created! Access code: ${accessCode}`;
    } else {
      successMessage.textContent = 'Election created successfully!';
    }

    // Reset form
    electionForm.reset();
    candidatesContainer.innerHTML = '';
    addCandidate();

  });
});
