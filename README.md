# 🍳 The Abroad Living Cookbook & High-Yield Meals

A practical static web application and culinary guide engineered for living abroad alone. Built from authentic student/bachelor kitchen experiments, featuring high-yield batch preps, lightning-fast comfort meals, an interactive ingredient matcher, a grocery shopping list generator, and a dedicated distraction-free **Stepwise Kitchen Mode**.

Live Repo: [https://github.com/shamsghani/cookbook](https://github.com/shamsghani/cookbook)

---

## 🌟 Key Features

### 1. 🍳 8 Core High-Yield Recipes
- **Default Grilled Chicken (Batch-Prep Edition)**: High-yield oven method with midway pan drainage that keeps chicken juicy and seared rather than boiled. Serves as the foundation protein for 3 other meals throughout the week.
- **Miscellaneous Rice (TM)**: Adaptable savory basmati rice base with gentle aromatics, stock cube, and a perfect low-flame steam (*dum*) finish.
- **Easy Cheesy Pasta with Crispy Chicken**: Creamy pink/blush sauce emulsified with starchy pasta water, heavy cream, and cheese, crowned with air-fried golden chicken tenders.
- **Easy French Bread Pizza (TM)**: Crusty split baguette/roll with seasoned tomato sauce, diced veggies, grilled chicken or seekh kebabs, cheese, and signature mayonnaise zigzag.
- **Quick Seekh Kabab Karahi (TM)**: 15-minute dhaba-style wok curry transforming pre-cooked or frozen seekh kebabs with canned tomatoes into a rich gravy with distinct oil separation (*rogaan*).
- **Easy Chicken Handi (Creamy Dhaba Style)**: White-style creamy stovetop handi with seared chicken cubes, cream reduction, crushed chillies, and optional melted cheese velvet finish.
- **Crispy & Tangy Grilled Chicken Sandwich**: Classic deli stack engineered with a double mayonnaise-lettuce barrier to keep toasted bread crisp against spiced meat and pickles.
- **Easy Loaded Upgrade Pizza**: The ultimate cheat code—turning frozen cheese pizza or bare crust into a bakery-style pizza loaded with kebabs/chicken, peppers, and garlic-mayo drizzle.

### 2. 👨‍🍳 Two Viewing Modes
- **📖 Full Recipe (Detailed Mode)**:
  - Complete explanations from `recipes full.txt` explaining *why* techniques work (e.g. Render Phase vs Sear Phase, starch emulsification, steam craters).
  - Scalable portions (0.5x, 1x, 2x, 3x) that dynamically recalculate ingredient quantities.
  - Interactive counter checklist for ingredients.
  - Gear & equipment list.
  - Chef's Notes and Quick Fix Tips.
  - Cross-recipe companion links showing how batch-prepped proteins unlock fast meals.
- **👨‍🍳 Stepwise Kitchen Mode**:
  - Distraction-free, large-typography interface designed for counter/stove use.
  - Step-by-step progress tracking.
  - **⚡ Simultaneous Operations Alert**: Tells you what to prep or clean in parallel while waiting (e.g. washing rice while broth boils, air frying tenders while pasta boils).
  - **Integrated Cooking Countdown Timer**: Pre-configured timers with synthesized audio chime alerts (Web Audio API).
  - Keyboard navigation (`←` for previous, `→` or `Space` for next).

### 3. 🔍 Ingredient Matcher ("What Can I Make?")
- Select what you currently have in your kitchen or click **"Sync with My Pantry Checklist"**.
- Automatically ranks all recipes by match percentage:
  - 🌟 **100% Ready to Cook!** (All core ingredients available)
  - 🟡 **Missing 1 Item** (With 1-click `+ Add missing to shopping list` button)
  - 🟠 Missing 2+ Items

### 4. 🧺 Abroad Living Pantry Checklist (25 Essentials)
- Curated convenience staples from `cokcook pantry.txt` that make solo living effortless:
  - **Freezer Staples**: Seekh kebabs, frozen chips, parathas, shami kebabs, chicken tenders.
  - **Canned & Gravy Bases**: Canned tomatoes, pizza sauce, canned chanay.
  - **Dairy & Cheese**: Heavy cooking cream, shredded cheese, plain yogurt (dahi), milk.
  - **Fresh Produce**: Onions, shimla mirch (bell pepper).
  - **Bakery & Carbs**: French roll/baguette, basmati rice, sandwich bread, naan.
  - **Condiments & Oils**: Cooking oil/ghee, mayonnaise, sriracha mayo.
  - **Comfort & Snacks**: Dark chocolate digestive biscuits, salted chips, cereal, Nutella.
- Progress bar tracking pantry readiness (`X / 25 Stocked`).
- 1-Click **"Add All Missing Items to Shopping List"**.

### 5. 🛒 Smart Grocery Shopping List
- Consolidates ingredients from selected recipes or missing pantry items.
- Custom item addition.
- Interactive cross-off while walking supermarket aisles.
- **📋 Copy for WhatsApp / Notes**: Formatted markdown list with `[ ]` checkboxes ready to send or save.
- Clean print view (`Ctrl+P`).
- Persisted locally across browser sessions via `localStorage`.

---

## 🚀 How to Run Locally

This is a zero-dependency static web application. You don't need Node, npm, or any build tool:

1. Clone the repository:
   ```bash
   git clone https://github.com/shamsghani/cookbook.git
   ```
2. Open `index.html` directly in any web browser (Chrome, Edge, Firefox, Safari).

Alternatively, run a simple local web server:
```bash
# Python
python -m http.server 8000

# Node.js
npx serve .
```
Then navigate to `http://localhost:8000`.

---

## 🌐 Deploying to GitHub Pages

1. In your GitHub repository settings, navigate to **Pages** (under Code and automation).
2. Under **Build and deployment > Source**, select **Deploy from a branch**.
3. Choose branch `main` and folder `/ (root)`.
4. Click **Save**. Your cookbook will be live at `https://shamsghani.github.io/cookbook/`.

---

## 📁 Repository Structure

```
cookbook/
├── index.html            # Main semantic HTML5 application
├── styles.css            # Responsive culinary CSS theme & print styles
├── app.js                # State management, kitchen mode, timer & shopping list
├── recipes-data.js       # Complete structured dataset (recipes & pantry items)
├── cokcook pantry.txt    # Original 25 living-abroad convenience pantry items
├── cookbook recipes.txt  # Stepwise instructions & simultaneous operations
├── recipes full.txt      # Comprehensive detailed recipes & chef's notes
└── README.md             # Project documentation
```
