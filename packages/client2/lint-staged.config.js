module.exports = {
  "*.ts?(x)": (filenames) => [
    ...filenames.map((filename) => `prettier --write ${filename}`),
    ...filenames.map((filename) => `eslint --fix ${filename}`),
    "yarn typecheck",
  ],
  "*.js?(x)": (filenames) => [
    ...filenames.map((filename) => `prettier --write ${filename}`),
    ...filenames.map((filename) => `eslint --fix ${filename}`),
  ],
  "*.md?(x)": (filenames) =>
    filenames.map((filename) => `prettier --write ${filename}`),
};
