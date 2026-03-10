import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDhP3xFEswtfviA7_9vcEkwWETEg_EXXSo",
  authDomain: "zap-conncet.firebaseapp.com",
  databaseURL: "https://zap-conncet-default-rtdb.firebaseio.com",
  projectId: "zap-conncet",
  storageBucket: "zap-conncet.firebasestorage.app",
  messagingSenderId: "1052061249045",
  appId: "1:1052061249045:web:204b6789af66fa2325681c",
  measurementId: "G-Y219GR034V",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
