// Money is ALWAYS integer paise (1 rupee = 100 paise). No floats for money.
// Pure module: no I/O, no Date.now().

export type Paise = number;

export function assertPaise(value: number): asserts value is Paise {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Money must be an integer number of paise, got ${value}`);
  }
}

/** Whole rupees -> paise. Rupee input must be an integer (use rupeesToPaiseRounded for typed input). */
export function rupeesToPaise(rupees: number): Paise {
  if (!Number.isSafeInteger(rupees)) {
    throw new RangeError(`Rupees must be a whole number, got ${rupees}`);
  }
  return rupees * 100;
}

/** For user-typed rupee amounts that may have decimals (e.g. "3200.50"): rounds to nearest paise. */
export function rupeesToPaiseRounded(rupees: number): Paise {
  if (!Number.isFinite(rupees)) throw new RangeError(`Invalid rupee amount: ${rupees}`);
  return Math.round(rupees * 100);
}

/** paise * integer quantity, exact. */
export function mulPaise(paise: Paise, quantity: number): Paise {
  assertPaise(paise);
  if (!Number.isSafeInteger(quantity)) throw new RangeError(`Quantity must be an integer, got ${quantity}`);
  return paise * quantity;
}

/** Percentage of an amount in basis points (1% = 100 bp), rounded half up to whole paise. */
export function percentOfPaise(paise: Paise, basisPoints: number): Paise {
  assertPaise(paise);
  if (!Number.isSafeInteger(basisPoints)) throw new RangeError("basisPoints must be an integer");
  return Math.round((paise * basisPoints) / 10000);
}

/** Indian digit grouping, e.g. 12500000 paise -> "₹1,25,000". Display only. */
export function formatINR(paise: Paise): string {
  assertPaise(paise);
  const rupees = paise / 100;
  const hasPaise = paise % 100 !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  }).format(rupees);
}
