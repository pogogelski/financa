
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAZ7xBke6ZO6u8jSRM0ET-EW-auh0jyLkU",
  authDomain:        "financa-f20b7.firebaseapp.com",
  projectId:         "financa-f20b7",
  storageBucket:     "financa-f20b7.firebasestorage.app",
  messagingSenderId: "899997330411",
  appId:             "1:899997330411:web:d7a47e8a25b429f71007ae"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);


const userDoc  = (uid, ...path) => doc(db, 'users', uid, ...path);
const userCol  = (uid, col)     => collection(db, 'users', uid, col);

export {
  auth, db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  doc, getDoc, setDoc,
  collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy,
  userDoc, userCol
};
