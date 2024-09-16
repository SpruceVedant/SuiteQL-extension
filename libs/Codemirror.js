function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('myDatabase', 1);  // Open a database or create it if it doesn't exist

        // Triggered if the database needs to be created or upgraded
        request.onupgradeneeded = function (event) {
            const db = event.target.result;  // event.target.result is the database object (IDBDatabase)
            const objectStore = db.createObjectStore('myObjectStore', { keyPath: 'id', autoIncrement: true });
            console.log('Object store created');
        };

        // Triggered if the database is successfully opened
        request.onsuccess = function (event) {
            const db = event.target.result;  // event.target.result is the opened database
            console.log('Database initialized');
            resolve(db);  // Resolve the promise with the opened database
        };

        // Triggered if there is an error during the request
        request.onerror = function (event) {
            console.error('Error initializing database:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}
