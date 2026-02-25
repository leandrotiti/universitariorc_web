import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { userModelFromMap } from '../models/UserModel';

const AuthContext = createContext(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userModel, setUserModel] = useState(null);
    const [activeRole, setActiveRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const model = userModelFromMap(userDoc.data());
                        setUserModel(model);
                        // Restore saved role or use first role
                        const saved = localStorage.getItem(`activeRole_${user.uid}`);
                        if (saved && model.roles.includes(saved)) {
                            setActiveRole(saved);
                        } else {
                            setActiveRole(model.roles[0]);
                        }
                    } else {
                        setUserModel(null);
                        setActiveRole(null);
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                    setUserModel(null);
                    setActiveRole(null);
                }
            } else {
                setUserModel(null);
                setActiveRole(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const signIn = async (emailOrUsername, password) => {
        let emailToUse = emailOrUsername;

        // Si no contiene @, asumimos que es un username
        if (!emailOrUsername.includes('@')) {
            const q = query(
                collection(db, 'users'),
                where('username', '==', emailOrUsername),
                limit(1)
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                throw new Error('Usuario no encontrado.');
            }
            emailToUse = snapshot.docs[0].data().email;
        }

        const result = await signInWithEmailAndPassword(auth, emailToUse, password);

        // Fetch user model
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (userDoc.exists()) {
            const model = userModelFromMap(userDoc.data());
            setUserModel(model);
            // Restore saved role or use first role
            const saved = localStorage.getItem(`activeRole_${result.user.uid}`);
            if (saved && model.roles.includes(saved)) {
                setActiveRole(saved);
            } else {
                setActiveRole(model.roles[0]);
            }
            return model;
        }
        return null;
    };

    const switchRole = (role) => {
        if (userModel && userModel.roles.includes(role)) {
            setActiveRole(role);
            localStorage.setItem(`activeRole_${currentUser.uid}`, role);
        }
    };

    const signOut = async () => {
        if (currentUser) {
            localStorage.removeItem(`activeRole_${currentUser.uid}`);
        }
        await firebaseSignOut(auth);
        setUserModel(null);
        setActiveRole(null);
    };

    const value = {
        currentUser,
        userModel,
        activeRole,
        loading,
        signIn,
        signOut,
        switchRole,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
