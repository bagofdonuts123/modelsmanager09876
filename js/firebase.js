/* Firebase Configuration — uses compat SDK loaded from CDN */
const firebaseConfig = {
   apiKey: "AIzaSyB7KQZQxFrKyr2gwYAOir8fVO_eXgWVl48",
   authDomain: "models-8ef22.firebaseapp.com",
   projectId: "models-8ef22",
   storageBucket: "models-8ef22.firebasestorage.app",
   messagingSenderId: "802274508112",
   appId: "1:802274508112:web:c20c6974acea5c6be2c055",
   measurementId: "G-C06GMK0NT6"
};

firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const db = firebase.firestore();
