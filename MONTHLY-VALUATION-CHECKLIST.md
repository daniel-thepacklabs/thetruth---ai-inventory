# Monthly Inventory Valuation Update Checklist

**Run this on the 1st or 2nd of each month** to capture end-of-month inventory valuation.

## Steps

### 1. Export from Finale
1. Log in to [Finale Inventory](https://app.finaleinventory.com)
2. Go to **Reports → Inventory Valuation → Inventory Valuation By Location In Units W Detail**
3. Click **Export to Excel**
4. Save the file (it will be named `InventoryValuationByLocationInUnitsWDetail.xlsx`)

### 2. Run the build script
Open a terminal in the project directory and run:

```bash
node scripts/build-valuation.cjs "path/to/InventoryValuationByLocationInUnitsWDetail.xlsx" 2026-MM
```

Replace `2026-MM` with the month (e.g., `2026-10` for October).

This script:
- Reads the Excel export
- Aggregates across locations using **average cost** (the same method Finale uses)
- Outputs the JSON entry to paste into `valuation-history.json`

### 3. Update valuation-history.json
- Open `src/data/valuation-history.json`
- Add the new month's entry
- Verify the grand total looks reasonable (~$3.3M typically)

### 4. Commit and push
```bash
git add src/data/valuation-history.json
git commit -m "Add MONTH inventory valuation from Finale export"
git push
```

## Important Notes
- **Always use Finale's Inventory Valuation report** — NOT the API's `lastPurchaseLandedCostPerUnit`
- The report uses **average cost** per product, which is the correct accounting method
- Products span multiple locations — the script aggregates them automatically
- Grand total should be in the $3M–$4M range; if it's drastically different, double-check the export
