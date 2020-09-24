function croppedAddress(address) {
  if (!address) {
    return '';
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export { croppedAddress };
