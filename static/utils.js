function everyArrayElement(array, el) {
  for (var i = 0; i < array.length; i++) {
    if (array[i] !== el) {
      return false;
    }
  }
  return true;
}

export {
  everyArrayElement
};
