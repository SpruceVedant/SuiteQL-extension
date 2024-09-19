function initDB() {
    return new Promise((resolve, reject) => {
      
        const request = indexedDB.open('myDatabase', 1);

      
        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            const objectStore = db.createObjectStore('myObjectStore', { keyPath: 'id', autoIncrement: true });
            console.log('Object store created');
        };

       
        request.onsuccess = function (event) {
            const db = event.target.result;
            console.log('Database initialized');
            resolve(db);
        };

      
        request.onerror = function (event) {
            console.error('Error initializing database:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}


function addData(db, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['myObjectStore'], 'readwrite');
        const objectStore = transaction.objectStore('myObjectStore');
        const request = objectStore.add(data);

        request.onsuccess = function (event) {
            console.log('Data added to database');
            resolve(event);
        };

        request.onerror = function (event) {
            console.error('Error adding data:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}


initDB().then((db) => {
    addData(db, { name: 'John Doe', email: 'john@example.com' });
});

function getData(db, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['myObjectStore'], 'readonly');
        const objectStore = transaction.objectStore('myObjectStore');
        const request = objectStore.get(id);

        request.onsuccess = function (event) {
            if (request.result) {
                console.log('Data retrieved:', request.result);
                resolve(request.result);
            } else {
                console.log('No data found');
                resolve(null);
            }
        };

        request.onerror = function (event) {
            console.error('Error retrieving data:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}


initDB().then((db) => {
    getData(db, 1).then((data) => {
        if (data) {
            console.log('Data:', data);
        }
    });
});



document.addEventListener('DOMContentLoaded', function () {
    
    initDB().then((db) => {
      
        getData(db, 1).then((data) => {
            if (data) {
                document.getElementById('nameField').value = data.name;
                document.getElementById('emailField').value = data.email;
            }
        });

        
        document.getElementById('saveBtn').addEventListener('click', function () {
            const name = document.getElementById('nameField').value;
            const email = document.getElementById('emailField').value;
            addData(db, { name, email });
        });
    });
});
