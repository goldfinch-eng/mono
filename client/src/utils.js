function croppedAddress(address) {
  if (!address) {
    return '';
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function displayNumber(val, decimals) {
  if (val === '') {
    return '';
  }
  const valFloat = parseFloat(val);
  if (!decimals && Math.floor(valFloat) === valFloat) {
    decimals = 0;
  } else if (!decimals) {
    decimals = valFloat.toString().split('.')[1].length || 0;
  }

  return valFloat.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export { croppedAddress, displayNumber };
