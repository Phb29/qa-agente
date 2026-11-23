#!/usr/bin/env node
// CPF válido (dígitos verificadores certos), para o cadastro que o teste precisa completar — a nota
// fiscal não sai para aluno sem CPF. Com semente, o mesmo CPF sempre: o ticket repete o dado entre
// critérios e rodadas, e o relatório cita um valor que se reproduz.
//
//   node manual/tools/cpf.mjs              → 12345678909 (aleatório)
//   node manual/tools/cpf.mjs ABC-123-a    → sempre o mesmo para essa semente
//   node manual/tools/cpf.mjs --formatado  → 123.456.789-09

import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const formatado = args.includes("--formatado");
const semente = args.find((a) => !a.startsWith("--"));

const bytes = semente ? createHash("sha256").update(semente).digest() : crypto.getRandomValues(new Uint8Array(9));
let d = Array.from(bytes.slice(0, 9), (b) => b % 10);
// CPF de dígitos todos iguais passa na conta e é recusado pela Receita (e pelo sistema).
if (new Set(d).size === 1) d[8] = (d[8] + 1) % 10;
const dv = (base) => {
  const resto = (base.reduce((s, n, i) => s + n * (base.length + 1 - i), 0) * 10) % 11;
  return resto === 10 ? 0 : resto;
};
d.push(dv(d));
d.push(dv(d));
const cpf = d.join("");
console.log(formatado ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : cpf);
