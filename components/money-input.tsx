"use client";

import { InputHTMLAttributes } from "react";
import { finalizeMoneyInput, formatMoneyTyping } from "@/lib/money-input";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  allowNegative?: boolean;
};

export function MoneyInput({ value, onValueChange, allowNegative = false, onBlur, ...props }: Props) {
  return <input
    {...props}
    type="text"
    inputMode="decimal"
    value={value}
    onChange={event => onValueChange(formatMoneyTyping(event.target.value, allowNegative))}
    onBlur={event => {
      onValueChange(finalizeMoneyInput(event.target.value, allowNegative));
      onBlur?.(event);
    }}
  />;
}
