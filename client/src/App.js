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

function App() {
  return (
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
  )
}

export default App;
