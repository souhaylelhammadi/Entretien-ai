import { createSlice } from "@reduxjs/toolkit";

const interviewsSlice = createSlice({
  name: "interviews",
  initialState: {
    selectedInterview: null,
    showCard: false,
  },
  reducers: {
    setSelectedInterview: (state, action) => {
      state.selectedInterview = action.payload;
      state.showCard = true;
    },
    closeCard: (state) => {
      state.selectedInterview = null;
      state.showCard = false;
    },
  },
});

export const { setSelectedInterview, closeCard } = interviewsSlice.actions;
export default interviewsSlice.reducer; 