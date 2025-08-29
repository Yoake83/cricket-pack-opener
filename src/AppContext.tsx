import { createContext, useContext, useReducer, type ReactNode } from "react";

// Types
type Card = {
  id: string;
  name: string;
  tier: "Common" | "Rare" | "Epic" | "Legend";
  role: string;
  rating: number;
  team: string;
};

type State = {
  collection: Card[];
  coins: number;
  muted: boolean;
};

type Action =
  | { type: "ADD_CARDS"; cards: Card[] }
  | { type: "TOGGLE_MUTE" }
  | { type: "ADD_COINS"; amount: number };

const initialState: State = {
  collection: [],
  coins: 1000,
  muted: false,
};

// Reducer
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_CARDS":
      return { ...state, collection: [...state.collection, ...action.cards] };
    case "TOGGLE_MUTE":
      return { ...state, muted: !state.muted };
    case "ADD_COINS":
      return { ...state, coins: state.coins + action.amount };
    default:
      return state;
  }
}

// Context
const AppContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// Hook
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};
