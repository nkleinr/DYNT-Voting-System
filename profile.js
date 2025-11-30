document.addEventListener('DOMContentLoaded', function() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));

  // Must be logged in
  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }

  // --------- Form + fields ---------
  const profileForm = document.getElementById('profileForm');

  const fullNameInput = document.getElementById('profileFullName');
  const ageInput = document.getElementById('profileAge');
  const usernameInput = document.getElementById('profileUsername');
  const emailInput = document.getElementById('profileEmail');

  const oldPasswordInput = document.getElementById('profileOldPassword');
  const passwordInput = document.getElementById('profilePassword');
  const confirmPasswordInput = document.getElementById('profileConfirmPassword');

  const oldPasswordError = document.getElementById('profileOldPasswordError');
  const passwordError = document.getElementById('profilePasswordError');
  const confirmPasswordError = document.getElementById('profileConfirmPasswordError');
  const successMessage = document.getElementById('profileSuccess');

  const voteHistoryContainer = document.getElementById('voteHistory');

  // Prefill current user info
  fullNameInput.value = currentUser.fullName || '';
  ageInput.value = currentUser.age != null ? currentUser.age : '';
  usernameInput.value = currentUser.username || '';
  emailInput.value = currentUser.email || '';

  // If username shouldn't be editable, make sure it's readonly in HTML

  // --------- Password validation helper ---------
  function validatePassword(password) {
    const minLength = 8;
    const hasCapital = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (password.length < minLength) {
      return "Password must be at least 8 characters long";
    }
    if (!hasCapital) {
      return "Password must include at least 1 capital letter";
    }
    if (!hasNumber) {
      return "Password must include at least 1 number";
    }
    return null;
  }

  // --------- Profile form submit ---------
  profileForm.addEventListener('submit', function(event) {
    event.preventDefault();

    // Clear messages
    oldPasswordError.textContent = '';
    passwordError.textContent = '';
    confirmPasswordError.textContent = '';
    successMessage.textContent = '';

    const updatedFullName = fullNameInput.value.trim();
    const updatedAge = parseInt(ageInput.value, 10);
    const updatedEmail = emailInput.value.trim();

    const oldPassword = oldPasswordInput.value;
    const newPassword = passwordInput.value;
    const confirmNewPassword = confirmPasswordInput.value;

    // Basic validation
    if (!updatedFullName || !updatedEmail || isNaN(updatedAge)) {
      alert("Please fill in all required fields.");
      return;
    }

    if (updatedAge < 13) {
      alert("You must be at least 13 years old.");
      return;
    }

    let finalPassword = currentUser.password;

    // If any password fields are filled, treat as password change
    if (oldPassword || newPassword || confirmNewPassword) {

      // Require old password
      if (!oldPassword) {
        oldPasswordError.textContent = "Enter your current password to change it";
        return;
      }

      // Old password must match
      if (oldPassword !== currentUser.password) {
        oldPasswordError.textContent = "Current password is incorrect";
        return;
      }

      // New password must be provided
      if (!newPassword) {
        passwordError.textContent = "Enter a new password";
        return;
      }

      // Validate new password strength
      const passwordErrorMsg = validatePassword(newPassword);
      if (passwordErrorMsg) {
        passwordError.textContent = passwordErrorMsg;
        return;
      }

      // Confirm passwords match
      if (newPassword !== confirmNewPassword) {
        confirmPasswordError.textContent = "Passwords do not match";
        return;
      }

      finalPassword = newPassword;
    }

    // Update storage
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    const username = currentUser.username;

    if (!users[username]) {
      alert('Error: user record not found. Please log in again.');
      localStorage.removeItem('currentUser');
      window.location.href = 'index.html';
      return;
    }

    users[username] = {
      ...users[username],
      fullName: updatedFullName,
      age: updatedAge,
      email: updatedEmail,
      password: finalPassword
    };

    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(users[username]));

    // Clear password fields
    oldPasswordInput.value = '';
    passwordInput.value = '';
    confirmPasswordInput.value = '';

    successMessage.textContent = "Profile updated successfully!";
  });

  // --------- Voting History ---------
  function renderVotingHistory() {
    voteHistoryContainer.innerHTML = '';

    const elections = JSON.parse(localStorage.getItem('elections') || '[]');
    const records = [];

    elections.forEach(election => {
      if (!Array.isArray(election.votes)) return;

      election.votes.forEach(vote => {
        if (vote.username === currentUser.username) {
          const candidate = election.candidates[vote.candidateIndex];

          records.push({
            electionTitle: election.title,
            electionId: election.id,
            status: election.isClosed ? 'Closed' : 'Open',
            candidateName: candidate ? candidate.name : 'Unknown Candidate',
            votedAt: vote.votedAt,
            visibility: election.visibility,
            ownerUsername: election.ownerUsername,
            endAt: election.endAt // may be undefined for older elections
          });
        }
      });
    });

    if (records.length === 0) {
      voteHistoryContainer.innerHTML = '<p>You have not voted in any elections yet.</p>';
      return;
    }

    // Show most recent votes first
    records.sort((a, b) => {
      const t1 = a.votedAt ? Date.parse(a.votedAt) : 0;
      const t2 = b.votedAt ? Date.parse(b.votedAt) : 0;
      return t2 - t1;
    });

    records.forEach(record => {
      const item = document.createElement('div');
      item.style.textAlign = 'left';
      item.style.marginTop = '1rem';
      item.style.paddingTop = '0.75rem';
      item.style.borderTop = '1px solid #eee';

      item.innerHTML = `
        <p><strong>Election:</strong> 
          <a href="results.html?id=${record.electionId}">
            ${record.electionTitle}
          </a>
        </p>

        <p><strong>Status:</strong> ${record.status}</p>
        <p><strong>Your Vote:</strong> ${record.candidateName}</p>

        <p><strong>Visibility:</strong> ${record.visibility === 'public' ? 'Public' : 'Private'}</p>
        <p><strong>Owner:</strong> ${record.ownerUsername}</p>

        ${record.endAt ? `<p><strong>Ends At:</strong> ${new Date(record.endAt).toLocaleString()}</p>` : ''}

        ${record.votedAt ? `<p><strong>Voted At:</strong> ${new Date(record.votedAt).toLocaleString()}</p>` : ''}
      `;

      voteHistoryContainer.appendChild(item);
    });
  }

  // Initial render of history
  renderVotingHistory();
});

