import React from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
} from "react-router-dom";
import Borrow from './components/borrow.js';
import Earn from './components/earn.js';
import Footer from "./components/footer";
import Header from "./components/header";

import { Drizzle } from '@drizzle/store';
import { DrizzleContext } from "@drizzle/react-plugin";
import drizzleOptions from "./drizzleOptions";

// const drizzle = new Drizzle(drizzleOptions);

function App() {
  return (
    // <DrizzleContext.Provider drizzle={drizzle}>
    <Router>
      <Header/>
      <div>
        <Switch>
          <Route exact path="/">
            <Borrow/>
          </Route>
          <Route path="/about">
            {/* <About /> */}
          </Route>
          <Route path="/earn">
            <Earn/>
          </Route>
        </Switch>
      </div>
      <Footer />
    </Router>
    // </DrizzleContext.Provider>
  )
}

export default App;
