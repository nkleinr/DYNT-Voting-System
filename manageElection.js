document.addEventListener("DOMContentLoaded", async () => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (!currentUser) {
        alert("You must be logged in.");
        location.href = "index.html";
        return;
    }

    const electionList = document.getElementById("electionList");
    const db = firebase.firestore();

    async function loadElections() {
        electionList.innerHTML = "";
        const snapshot = await db.collection("elections").get();

        snapshot.forEach(doc => {
            const election = doc.data();
            const id = doc.id;

            const div = document.createElement("div");
            div.className = "election-card";
            div.innerHTML = `
                <h3>${election.title}</h3>
                <p>Status: <b>${election.status || "closed"}</b></p>
                <button onclick="toggleElectionStatus('${id}', 'open')">Open Election</button>
                <button onclick="toggleElectionStatus('${id}', 'closed')">Close Election</button>
                <hr>
            `;
            electionList.appendChild(div);
        });
    }

    window.toggleElectionStatus = async (id, status) => {
        await db.collection("elections").doc(id).update({ status });
        alert("Election " + status);
        loadElections();
    }

    loadElections();
});
