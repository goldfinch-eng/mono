import React from 'react';
import { Button } from 'rimble-ui';

export default function Pool(props) {
  const { instance } = props;

  const deposit = async instance => {
    console.log("Would deposit things!")
  };

  return (
    <div>
      <h1>Hey I'm the pool, and I'm at {instance.address}</h1>
      <Button onClick={deposit}>Deposit funds now!</Button>
    </div>
  )
}
