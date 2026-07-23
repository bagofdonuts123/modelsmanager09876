import htm from 'https://unpkg.com/htm?module';

const {
   createElement, Fragment,
   useState, useEffect, useRef, useCallback, useMemo,
   useContext, createContext, memo
} = React;

const html = htm.bind(createElement);

export {
   html, createElement, Fragment,
   useState, useEffect, useRef, useCallback, useMemo,
   useContext, createContext, memo
};
