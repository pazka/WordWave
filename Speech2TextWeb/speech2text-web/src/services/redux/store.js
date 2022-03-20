import { configureStore } from '@reduxjs/toolkit';
import adminReducer from './adminSlice';
import logger from "redux-logger";
import thunk from "redux-thunk";
import {Store} from "@reduxjs/toolkit";

export const store :Store = configureStore({
    reducer: {
        admin: adminReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: false
    }).concat(logger).concat(thunk)
});

export const getState = store.getState