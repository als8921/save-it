import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthState =
  | { status: "loading"; session: null }
  | { status: "authenticated"; session: Session }
  | { status: "anonymous"; session: null };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    session: null,
  });

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState(
        data.session
          ? { status: "authenticated", session: data.session }
          : { status: "anonymous", session: null }
      );
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(
        session
          ? { status: "authenticated", session }
          : { status: "anonymous", session: null }
      );
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
