import { configureStore } from "@reduxjs/toolkit";

import { boardSlice } from "features/board/BoardSlice";
import { viewSlice } from "features/board/viewSlice";

export const store = configureStore({
  reducer: {
    board: boardSlice.reducer,
    view: viewSlice.reducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;

// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
