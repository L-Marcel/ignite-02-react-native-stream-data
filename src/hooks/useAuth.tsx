import { makeRedirectUri, revokeAsync, startAsync } from "expo-auth-session";
import { useEffect, createContext, useContext, useState, ReactNode } from "react";
import { generateRandom } from "expo-auth-session/build/PKCE";

import { api } from "../services/api";

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
  authorization: "https://id.twitch.tv/oauth2/authorize",
  revocation: "https://id.twitch.tv/oauth2/revoke",
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState("");

  async function signIn() {
    try {
      setIsLoggingIn(true);

      const clientId = process.env.CLIENT_ID;
      const redirectUri = makeRedirectUri({ useProxy: true });
      const responseType = "token";
      const scope = encodeURI("openid user:read:email user:read:follows");
      const forceVerify = true;
      const state = generateRandom(30);

      const authUrl =
        twitchEndpoints.authorization +
        `?client_id=${clientId}` +
        `&redirect_uri=${redirectUri}` +
        `&response_type=${responseType}` +
        `&scope=${scope}` +
        `&force_verify=${forceVerify}` +
        `&state=${state}`;

      const res = await startAsync({ authUrl });

      if (res.type === "success" && res.params.error !== "access_denied") {
        if (state !== res.params.state) {
          throw new Error("Invalid state value");
        }

        api.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${res.params.access_token}`;

        const userResponse = await api.get("/users");
        const userData = userResponse.data.data[0];

        setUser({
          id: userData.id,
          display_name: userData.display_name,
          email: userData.email,
          profile_image_url: userData.profile_image_url,
        });

        setUserToken(res.params.access_token);
      }
    } catch (error) {
      throw new Error();
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function signOut() {
    try {
      setIsLoggingOut(true);

      const clientId = process.env.CLIENT_ID;

      await revokeAsync(
        {
          token: userToken,
          clientId,
        },
        {
          revocationEndpoint: twitchEndpoints.revocation,
        }
      );
      // eslint-disable-next-line no-empty
    } catch (error) {
    } finally {
      setUser({} as User);
      setUserToken("");

      //Não conhecia isso...
      delete api.defaults.headers.common["Authorization"];

      //Tinha gostado, mas ai descobri que pode causar incompatibilidade em alguns navegadores...
      //Pena.

      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    api.defaults.headers.common["Client-Id"] = String(process.env.CLIENT_ID);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
