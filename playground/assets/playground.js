const options = {
  printWidth: 120,
};

const numInputs = ['printWidth'];
const boolInputs = ['liquidSingleQuote', 'singleQuote'];

const waitFor = (pred) => {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (pred()) {
        resolve();
        clearInterval(interval);
      }
    }, 50);
  });
};

numInputs.forEach((input) => {
  const rangeEl = document.getElementById(input + 'Number');
  const inputEl = document.getElementById(input + 'Range');

  inputEl.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    options[input.replace('Number', '')] = value;
    rangeEl.value = value;
    format();
  });

  rangeEl.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    options[input.replace('Range', '')] = value;
    inputEl.value = value;
    format();
  });
});

boolInputs.forEach((input) => {
  const el = document.getElementById(input);
  el.addEventListener('input', (e) => {
    options[input] = !!e.target.checked;
    format();
  });
});

function format() {
  try {
    output.value = prettier.format(input.value, {
      ...options,
      plugins: [prettierPluginLiquid],
      parser: 'liquid-html',
    });
    ruler.style.left = `${options.printWidth}ch`;
  } catch (error) {
    output.value = error.stack || error;
  }
}

function onKeyup(e) {
  if (e.ctrlKey && event.key === 'f') {
    input.value = output.value;
  }
}

async function main() {
  await waitFor(() => window.prettierPluginLiquid);
  format();
  input.oninput = format;
  input.addEventListener('keyup', onKeyup);
}

main();
