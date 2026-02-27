# 💰 PRICING ADMINISTRATION SYSTEM - COMPLETE

## ✅ WHAT WAS BUILT

### 1. **Backend API** (`/api/admin/pricing`)
Complete CRUD API for pricing configuration management:
- **GET** `/api/admin/pricing` - List all pricing configurations
- **GET** `/api/admin/pricing/:id` - Get single configuration
- **POST** `/api/admin/pricing` - Create new configuration  
- **PUT** `/api/admin/pricing/:id` - Update configuration
- **DELETE** `/api/admin/pricing/:id` - Delete configuration (except default)

### 2. **Database Schema** (`pricing_configs` table)
Flexible admin-controlled pricing with:
- Base pricing by BHK type (1-5 BHK)
- Distance-based rates (local/regional/intercity)
- Additional charges (floor, packing, fragile, labor)
- GST configuration
- City-specific pricing support
- Active/inactive status
- Default configuration flag

### 3. **Admin Web Interface** (`/admin/pricing`)
Professional, standalone pricing management page:
- Dashboard with statistics
- Grid view of all pricing configurations
- Create/Edit modal with full form
- Toggle active/inactive status
- Delete configurations (except default)
- Real-time updates
- Mobile responsive design

---

## 🚀 HOW TO USE

### **Access the Pricing Admin**
1. Navigate to: `http://localhost:3000/admin/pricing`
2. Login with admin credentials (same as main admin panel)
3. Click "💰 Pricing Config" from main admin sidebar

### **Create New Pricing Configuration**
1. Click "+ New Pricing Config" button
2. Fill in the form:
   - **Configuration Name**: e.g., "Mumbai Premium Pricing"
   - **City**: (Optional) e.g., "Mumbai" - leave empty for national default
   - **Status**: Active/Inactive, Default (only one can be default)
   - **Base Pricing**: Set rates for 1-5 BHK (₹)
   - **Distance Rates**: Local, Regional, Intercity (₹/km)
   - **Additional Charges**: Floor charge, Packing %, Fragile %, GST %
   - **Notes**: Optional description
3. Click "Save Configuration"

### **Edit Existing Configuration**
1. Click "✏️ Edit" button on any configuration card
2. Modify values as needed
3. Click "Save Configuration"

### **Activate/Deactivate Configuration**
- Click "⏸️ Deactivate" to temporarily disable a pricing model
- Click "▶️ Activate" to re-enable it
- Only active configurations are used for pricing calculations

### **Delete Configuration**
- Click "🗑️ Delete" button (not available for default config)
- Confirm deletion
- ⚠️ **Warning**: This action cannot be undone

---

## 📊 PRE-CONFIGURED PRICING

The system comes with **market-researched pricing** based on India 2025-26 data:

### **Default National Pricing**
| BHK Type | Base Price | Usage |
|----------|------------|-------|
| 1 BHK | ₹5,500 | Standard apartment |
| 2 BHK | ₹10,000 | Most common |
| 3 BHK | ₹16,000 | Family homes |
| 4 BHK | ₹21,000 | Large homes |
| 5 BHK | ₹28,000 | Luxury homes |

### **Distance Rates**
- **Local** (0-50 km): ₹12/km
- **Regional** (50-200 km): ₹20/km  
- **Intercity** (200+ km): ₹15/km

### **Additional Charges**
- Floor charge (no lift): ₹400/floor
- Packing materials: 25% of base
- Fragile items: 5% surcharge
- Labor: ₹700/person × 3 workers = ₹2,100
- GST: 18%

### **City-Specific Pricing**
- **Mumbai**: +9-10% premium (traffic, parking challenges)
- **Delhi**: Competitive (similar to national)
- **Bangalore**: +5% (tech hub demand)

---

## 🔧 TECHNICAL DETAILS

### **File Locations**
```
backend/
├── src/
│   ├── routes/
│   │   └── adminPricing.js          # API routes
│   ├── controllers/
│   │   └── pricingCalculator.js     # Pricing engine
│   └── index.js                      # Server (updated)
├── public/
│   ├── pricing-admin.html            # Admin UI
│   └── admin.html                    # Main admin (updated)
└── setup_pricing_system.sql          # Database schema
```

### **Database Schema**
```sql
pricing_configs (
  id UUID PRIMARY KEY,
  config_name VARCHAR(100),
  city VARCHAR(100),              -- NULL = national default
  is_default BOOLEAN,             -- Only one can be true
  is_active BOOLEAN,
  base_1bhk DECIMAL(10,2),
  base_2bhk DECIMAL(10,2),
  base_3bhk DECIMAL(10,2),
  base_4bhk DECIMAL(10,2),
  base_5bhk DECIMAL(10,2),
  rate_per_km_local DECIMAL(10,2),
  rate_per_km_regional DECIMAL(10,2),
  rate_per_km_intercity DECIMAL(10,2),
  floor_charge_no_lift DECIMAL(10,2),
  packing_material_percent DECIMAL(5,2),
  fragile_items_percent DECIMAL(5,2),
  gst_percent DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### **How Pricing Selection Works**
1. Customer creates a move with city information
2. System looks for **active** city-specific pricing
3. If not found, uses **default** pricing
4. Calculates distance using GPS coordinates
5. Applies all charges based on configuration
6. Generates estimate range (±10%)
7. Shows to both customer and agent

---

## 💡 USE CASES

### **Scenario 1: Launch in New City**
1. Create new pricing config
2. Set city name: "Hyderabad"
3. Adjust base rates based on local market research
4. Set as Active
5. Save - Now all Hyderabad moves use this pricing

### **Scenario 2: Seasonal Pricing Adjustment**
1. Edit existing configuration
2. Increase base rates by 10% for peak season
3. Add note: "Summer peak season pricing - June 2026"
4. Save - Immediately affects new moves

### **Scenario 3: Special Route Pricing**
1. Create pricing override in `pricing_overrides` table (database)
2. Set from_city: "Mumbai", to_city: "Pune"
3. Set fixed prices for this popular route
4. System automatically uses override when route matches

### **Scenario 4: A/B Testing Different Pricing**
1. Create two configs: "Conservative Pricing", "Premium Pricing"
2. Keep both inactive initially
3. Activate one at a time
4. Monitor conversion rates
5. Keep the better performing one

---

## ⚠️ IMPORTANT RULES

1. **Only ONE configuration can be default** at a time
   - Setting a new default automatically unsets the old one
   
2. **Default configuration CANNOT be deleted**
   - There must always be a fallback pricing model
   
3. **City names are case-insensitive**
   - "Mumbai", "mumbai", "MUMBAI" all match the same config
   
4. **Inactive configurations are NOT used**
   - They remain in database but won't affect pricing
   
5. **Changes take effect immediately**
   - New moves will use updated pricing right away
   - Existing moves keep their original estimates

---

## 🐛 TROUBLESHOOTING

### **Problem: "Session expired" error**
**Solution**: Login again at `/admin` with admin credentials

### **Problem: Can't delete a configuration**
**Solution**: Check if it's marked as default - defaults can't be deleted

### **Problem: Pricing not updating for new moves**
**Solution**: 
- Ensure configuration is set to Active
- Check the city name matches exactly
- Verify server is running (check logs)

### **Problem: No configurations showing**
**Solution**:
- Run `setup_pricing_system.sql` to create default configs
- Check database connection
- Verify you're logged in as admin

---

## 🚀 NEXT STEPS

### **Immediate**
1. ✅ Review pre-configured pricing
2. ✅ Adjust rates based on your market
3. ✅ Create city-specific configurations as needed
4. ✅ Test by creating sample moves

### **Advanced**
- Add pricing overrides for popular routes in database
- Set up seasonal pricing adjustments
- Monitor variance between estimates and agent quotes
- Refine pricing based on actual move costs

---

## 📞 SUPPORT

For technical issues or questions:
- Check server logs: `node src/index.js`
- Database issues: Connect via `psql -U amits4 -d moveassist`
- API testing: Use Postman or curl

**Server Running**: http://localhost:3000  
**Admin Panel**: http://localhost:3000/admin  
**Pricing Admin**: http://localhost:3000/admin/pricing

---

**Built with ❤️ for MoveAssist**  
*Last Updated: February 26, 2026*
