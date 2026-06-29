export const calcularExpressao = (expression) => {
  const tokens = expression.match(/\d+(?:\.\d+)?|[+\-*/%()]/g);
  if (!tokens || tokens.join("") !== expression.replace(/\s/g, "")) {
    return null;
  }

  let index = 0;

  const parseExpression = () => {
    let value = parseTerm();

    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const nextValue = parseTerm();
      value = operator === "+" ? value + nextValue : value - nextValue;
    }

    return value;
  };

  const parseTerm = () => {
    let value = parseFactor();

    while (
      tokens[index] === "*" ||
      tokens[index] === "/" ||
      tokens[index] === "%"
    ) {
      const operator = tokens[index++];
      const nextValue = parseFactor();

      if (operator === "*") value *= nextValue;
      if (operator === "/") value /= nextValue;
      if (operator === "%") value %= nextValue;
    }

    return value;
  };

  const parseFactor = () => {
    const token = tokens[index++];

    if (token === "+" || token === "-") {
      const value = parseFactor();
      return token === "-" ? -value : value;
    }

    if (token === "(") {
      const value = parseExpression();
      if (tokens[index++] !== ")") throw new Error("Invalid expression");
      return value;
    }

    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("Invalid expression");
    return value;
  };

  try {
    const result = parseExpression();
    return index === tokens.length && Number.isFinite(result) ? result : null;
  } catch (error) {
    return null;
  }
};
