import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Substitua com suas credenciais do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // Cole sua apiKey aqui
  authDomain: "zap-conncet.firebaseapp.com",
  databaseURL: "https://zap-conncet-default-rtdb.firebaseio.com",
  projectId: "zap-conncet",
  storageBucket: "zap-conncet.appspot.com",
  messagingSenderId: "1052061249045",
  appId: "1:1052061249045:web:204b6789af66fa2325681c",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
