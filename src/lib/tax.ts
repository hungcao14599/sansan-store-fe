import type { OrderItem, Product } from '../types';
import { toNumber } from './utils';

export const taxCategoryOptions = [
  { label: 'Không chịu thuế', value: 'NO_VAT' },
  { label: 'VAT 0%', value: 'VAT_0' },
  { label: 'VAT 5%', value: 'VAT_5' },
  { label: 'VAT 8%', value: 'VAT_8' },
  { label: 'VAT 10%', value: 'VAT_10' },
] as const;

export const taxCategoryLabels: Record<Product['taxCategory'], string> = {
  NO_VAT: 'Không VAT',
  VAT_0: 'VAT 0%',
  VAT_5: 'VAT 5%',
  VAT_8: 'VAT 8%',
  VAT_10: 'VAT 10%',
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateCheckoutPreview(
  items: Array<
    Pick<OrderItem, 'lineSubtotal' | 'taxRate' | 'quantity' | 'lineTotal'>
  >,
  discount: number,
) {
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + toNumber(item.lineSubtotal), 0),
  );
  const normalizedDiscount = roundMoney(Math.max(Math.min(discount, subtotal), 0));

  let remainingDiscount = normalizedDiscount;

  const pricedItems = items.map((item, index) => {
    const lineSubtotal = toNumber(item.lineSubtotal);
    const taxRate = toNumber(item.taxRate);
    const isLast = index === items.length - 1;
    const discountAmount = isLast
      ? remainingDiscount
      : roundMoney((normalizedDiscount * lineSubtotal) / Math.max(subtotal, 1));

    remainingDiscount = roundMoney(Math.max(remainingDiscount - discountAmount, 0));

    const taxableAmount = roundMoney(lineSubtotal - discountAmount);
    const taxAmount = roundMoney((taxableAmount * taxRate) / 100);
    const lineTotal = roundMoney(taxableAmount + taxAmount);

    return {
      discountAmount,
      taxableAmount,
      taxAmount,
      lineTotal,
    };
  });

  const taxableTotal = roundMoney(
    pricedItems.reduce((sum, item) => sum + item.taxableAmount, 0),
  );
  const tax = roundMoney(pricedItems.reduce((sum, item) => sum + item.taxAmount, 0));

  return {
    subtotal,
    discount: normalizedDiscount,
    taxableTotal,
    tax,
    total: roundMoney(taxableTotal + tax),
  };
}
