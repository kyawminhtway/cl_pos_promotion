odoo.define('cl_promotion_program.models', function(require){

const TYPES_DISCOUNT = ['fixed_discount', 'percent_discount'];
const TYPES_AMOUNT = ['buy_more_than_x_amount', 'buy_more_than_x_amount_from_categories', 'buy_more_than_x_amount_from_products'];
const TYPES_QTY = ['buy_more_than_x_qty', 'buy_more_than_x_qty_from_categories', 'buy_more_than_x_qty_from_products'];
const TYPES_CATEGORY = ['buy_more_than_x_amount_from_categories', 'buy_more_than_x_qty_from_categories'];
const TYPES_PRODUCT = ['buy_more_than_x_amount_from_products', 'buy_more_than_x_qty_from_products'];

var { PosGlobalState, Order, Orderline } = require('point_of_sale.models');
var Registries = require('point_of_sale.Registries');

var PromotionProgramPosGlobalState = (PosGlobalState) => class extends PosGlobalState{
    async _processData(loadedData) {
        await super._processData(...arguments);
        this.cl_promotion = {
            programs: loadedData['promotion.program'],
            rules: loadedData['promotion.rule'],
            combo_lines: loadedData['promotion.combo.line'],
            items: loadedData['promotion.item'],
            free_products: loadedData['promotion.free.product'],
            gift_icon: loadedData['cl_gift_icon'],
        };
    }
};

var PromotionProgramOrder = (Order) => class extends Order{
    add_product(product, options){
        var res = super.add_product(...arguments);
        if(!options.promotion_product){
            this.compute_cl_promotions();
        }
        return res;
    }
    set_orderline_options(orderline, options) {
        super.set_orderline_options(...arguments);
        if(options.cl_promotions !== undefined){
            orderline.cl_promotions = options.cl_promotions;
        }
    }
    remove_cl_programs(){
        var orderlines = Object.assign({}, this.orderlines);
        for(var index in orderlines){
            var orderline = orderlines[index];
            if(orderline.cl_promotions && orderline.cl_promotions.length > 0){
                orderline.set_quantity('remove');
            }
        }
    }
    apply_cl_programs(program_ids){
        this.remove_cl_programs();
        var merged_discount=0, merged_promotions=[], merged_discount_product_id=false;
        var applicable_programs = this.cl_applicable_programs;
        var item_by_id = this.pos.cl_promotion.items.by_id;
        for(var program_id of program_ids){
            var program = applicable_programs[program_id];
            var item = item_by_id[this.pos.cl_promotion.programs.by_id[program_id].item_id[0]];
            var occurrence = program.rule_occurrence;
            occurrence = item.item_rule === 'max_occurrence' && item.max_occurrence > 0 && occurrence > item.max_occurrence ? item.max_occurrence : occurrence;
            if(TYPES_DISCOUNT.includes(item.type)){
                if(item.type === 'fixed_discount'){
                    if(item.discount_rule !== 'order'){
                        occurrence = program.item.quantity;
                        occurrence = item.item_rule === 'max_occurrence' && item.max_occurrence > 0 && occurrence > item.max_occurrence ? item.max_occurrence : occurrence;
                    }
                    var price = item.discount * occurrence;
                }else{
                    if(item.discount_rule !== 'order'){
                        var amount = program.item.amount;
                    }else{
                        var amount = this.cl_promotion_utilities.amount.overall[item.price_rule];
                    }
                    var price = Math.floor(amount * (item.discount / 100), 2);
                }
                price = item.max_discount > 0 && price > item.max_discount ? item.max_discount : price;
                if(this.pos.cl_promotion.programs.by_id[program_id].can_be_merged){
                    merged_discount += price;
                    merged_promotions.push({
                        id: program_id, 
                        description: this.pos.cl_promotion.programs.by_id[program_id].name,
                        amount: price,
                    });
                    merged_discount_product_id = merged_discount_product_id === false ? item.product_id[0] : merged_discount_product_id;
                }else{
                    this.add_product(this.pos.db.get_product_by_id(item.product_id[0]), {
                        quantity: 1,
                        price: price * -1,
                        lst_price: price * -1,
                        extras: {price_automatically_set: true},
                        promotion_product: true,
                        cl_promotions: [{ id: program_id, description: this.pos.cl_promotion.programs.by_id[program_id].name }]
                    })
                }
            }else if(item.type === 'free_product'){
                var free_product_by_id = this.pos.cl_promotion.free_products.by_id;
                var free_product_ids = item.free_product_ids;
                for(var free_product_id of free_product_ids){
                    var free_product = free_product_by_id[free_product_id];
                    this.add_product(this.pos.db.get_product_by_id(free_product.product_id[0]), {
                        quantity: free_product.qty * occurrence,
                        price: 0,
                        lst_price: 0,
                        extras: {price_automatically_set: true},
                        promotion_product: true,
                        cl_promotions: [{ id: program_id, description: this.pos.cl_promotion.programs.by_id[program_id].name }]
                    })   
                }
            }
        }
        if(merged_discount > 0 && merged_discount_product_id){
            this.add_product(this.pos.db.get_product_by_id(merged_discount_product_id), {
                quantity: 1,
                price: merged_discount * -1,
                lst_price: merged_discount * -1,
                extras: {price_automatically_set: true},
                promotion_product: true,
                cl_promotions: merged_promotions
            })
        }
    }
    compute_cl_promotions(){
        this.prepare_cl_promotions_utilities();
        var applicable_programs={};
        var cl_promotion = this.pos.cl_promotion;
        for(var rule_id of cl_promotion.rules.ids){
            var occurrence=0;
            var rule = cl_promotion.rules.by_id[rule_id];
            if(TYPES_AMOUNT.includes(rule.type)){
                occurrence = this.get_cl_promotion_x_occurrence('amount', rule, rule.min_amt);
            }else if(TYPES_QTY.includes(rule.type)){
                occurrence = this.get_cl_promotion_x_occurrence('quantity', rule, rule.min_qty);
            }else if(rule.type === 'buy_combo_products'){
                occurrence = this.get_cl_promotion_combo_products_occurrence(rule);
            }
            var applicable = occurrence > 0;
            if(applicable){
                for(var program_id of rule.program_ids){
                    applicable_programs[program_id] = {rule_occurrence: occurrence};
                }
            }
        }
        for(var item_id of cl_promotion.items.ids){
            var item = cl_promotion.items.by_id[item_id];
            if(TYPES_DISCOUNT.includes(item.type) && item.discount_rule !== 'order'){
                var { amount, quantity } = this.check_discount_applicable(item);
                if(amount <= 0 || quantity <= 0){
                    for(var program_id of item.program_ids){
                        delete applicable_programs[program_id];
                    }
                    continue;
                }
                for(var program_id of item.program_ids){
                    if(applicable_programs[program_id] !== undefined){
                        applicable_programs[program_id].item = {amount, quantity};
                    }
                }
            }
        }
        var partner_id = this.get_partner() && this.get_partner().id || false;
        for(program_id in applicable_programs){
            var program = cl_promotion.programs.by_id[program_id];
            if(program.partner_ids && program.partner_ids.length > 0 && !program.partner_ids.includes(partner_id)){
                delete applicable_programs[program_id];
            }
        }
        this.cl_applicable_programs = applicable_programs;
        if(Object.keys(applicable_programs).length > 0){
            $('.cl-apply-promotion-button').addClass('apply-promotion-button-applicable');
        }else{
            $('.cl-apply-promotion-button').removeClass('apply-promotion-button-applicable');
        }
    }
    prepare_cl_promotions_utilities(){
        var amount = {overall: {tax_exclusive: 0, tax_inclusive: 0, discount_inclusive: 0}, by_product: {}, by_category: {}};
        var quantity = {overall: 0, by_product: {}, by_category: {}};
        for(var orderline of this.orderlines){
            if(orderline.cl_promotions.length > 0){
                continue;
            }
            var product_id = orderline.product.id;
            var category_id = orderline.product.pos_categ_id && orderline.product.pos_categ_id[0] || false;
            
            // Grouped Amount & Quantity By Product, By Category & Overall
            var prices = orderline.get_all_prices();
            var tax_exclusive = prices.priceWithoutTax;
            var tax_inclusive = prices.priceWithTaxBeforeDiscount;
            var discount_inclusive = prices.priceWithTax;
            var qty = orderline.get_quantity();
            
            amount.overall.tax_exclusive += tax_exclusive;
            amount.overall.tax_inclusive += tax_inclusive;
            amount.overall.discount_inclusive += discount_inclusive;
            quantity.overall += qty;

            var grouped_by_product = this.get_grouped_value(amount.by_product, product_id);
            grouped_by_product.tax_exclusive += tax_exclusive;
            grouped_by_product.tax_inclusive += tax_inclusive;
            grouped_by_product.discount_inclusive += discount_inclusive;
            amount.by_product[product_id] = grouped_by_product;
            quantity.by_product[product_id] = (quantity.by_product[product_id] || 0) + qty;
            
            if(category_id !== false){
                var grouped_by_category= this.get_grouped_value(amount.by_category, category_id);
                grouped_by_category.tax_exclusive += tax_exclusive;
                grouped_by_category.tax_inclusive += tax_inclusive;
                grouped_by_category.discount_inclusive += discount_inclusive;
                amount.by_category[category_id] = grouped_by_category;
                quantity.by_category[category_id] = (quantity.by_category[category_id] || 0) + qty;
            } 
        }
        this.cl_promotion_utilities = {amount, quantity};
    }
    // Helper Methods
    prepare_occurrence(value, min_value){
        return Math.floor(parseFloat(value) / parseFloat(min_value)) 
    }
    get_grouped_value(grouped_value, record_id){
        var values = grouped_value[record_id];
        if(values === undefined){
            values = {tax_exclusive: 0, tax_inclusive: 0, discount_inclusive: 0};
        }else{
            values = {
                tax_exclusive: values.tax_exclusive || 0, 
                tax_inclusive: values.tax_inclusive || 0, 
                discount_inclusive: values.discount_inclusive || 0
            };
        }
        return values;
    }
    check_discount_applicable(item){
        var amount=0, quantity=0;
        var utilities = this.cl_promotion_utilities;
        var record_ids = item.discount_rule === 'product' ? item.product_ids : item.category_ids;
        var products = utilities.amount.by_product;
        for(var product in products){
            product = this.pos.db.get_product_by_id(parseInt(product));
            var category_id = product.pos_categ_id ? product.pos_categ_id[0] : false;
            var record_id = item.discount_rule === 'product' ? product.id : category_id;
            if(record_ids.includes(record_id)){
                amount += utilities.amount[`by_${item.discount_rule}`][record_id][item.price_rule];
                quantity += utilities.quantity[`by_${item.discount_rule}`][record_id];
            }
        }
        return {amount, quantity};
    }
    get_cl_promotion_x_occurrence(type, rule, min_value){
        var utilities = this.cl_promotion_utilities;
        var value=0, category_ids=[], product_ids=[];
        if(TYPES_CATEGORY.includes(rule.type)){
            category_ids = rule.category_ids;
        }else if(TYPES_PRODUCT.includes(rule.type)){
            product_ids = rule.product_ids;
        }else{
            value = type === 'amount' ? utilities.amount.overall[rule.price_rule] : utilities.quantity.overall;
            return this.prepare_occurrence(value, min_value);
        }
        var products = type === 'amount' ? utilities.amount.by_product : utilities.quantity.by_product;
        for(var product in products){
            product = this.pos.db.get_product_by_id(parseInt(product));
            var product_id = product.id;
            var category_id = product.pos_categ_id ? product.pos_categ_id[0] : false;
            if(category_ids.includes(category_id)){
                value += type === 'amount' ? utilities.amount.by_category[category_id][rule.price_rule] : utilities.quantity.by_category[category_id];
            }else if(product_ids.includes(product_id)){
                value += type === 'amount' ? utilities.amount.by_product[product_id][rule.price_rule] : utilities.quantity.by_product[product_id];
            }
        }
        return this.prepare_occurrence(value, min_value);
    }
    get_cl_promotion_combo_products_occurrence(rule){
        var occurrence = 0;
        var utilities = this.cl_promotion_utilities;
        var cl_promotion = this.pos.cl_promotion;
        for(var combo_line_id of rule.combo_line_ids){
            var qty = 0;
            var combo_line = cl_promotion.combo_lines.by_id[combo_line_id];
            var record_ids = combo_line.based_on === 'product' ? combo_line.product_ids : combo_line.category_ids;
            for(var record_id of record_ids){
                qty += utilities.quantity[`by_${combo_line.based_on}`][record_id] || 0;
            }
            var line_occurrence = this.prepare_occurrence(qty, combo_line.qty);
            if(line_occurrence <= 0){
                occurrence = 0;
                break;
            }else if(occurrence === 0 || line_occurrence < occurrence){
                occurrence = line_occurrence;
            }
        }
        return occurrence;
    }
};

var PromotionProgramOrderline = (Orderline) => class extends Orderline{
    constructor(obj, options){
        super(...arguments);
        if(!options.json){
            this.cl_promotions = options.cl_promotions || [];
        }
    }
    init_from_JSON(json){
        super.init_from_JSON(...arguments);
        this.cl_promotions = json.cl_promotions || [];
    }
    export_as_JSON(){
        var res = super.export_as_JSON(...arguments);
        return {
            ...res,
            cl_promotions: this.cl_promotions,
        };
    };
    export_for_printing(){
        var res = super.export_for_printing(...arguments);
        return {
            ...res,
            cl_promotions: this.cl_promotions,
        };
    };
    can_be_merged_with(orderline){
        if(orderline.cl_promotions.length > 0 || this.cl_promotions.length > 0){
            return false;
        }
        return super.can_be_merged_with(...arguments);
    }
    set_quantity(quantity, keep_price){
        var res = super.set_quantity(...arguments);
        if(!this.cl_promotions || this.cl_promotions.length <= 0){
            this.order.compute_cl_promotions();
        }
        return res;
    }
    set_unit_price(price){
        super.set_unit_price(...arguments);
        if(!this.cl_promotions || this.cl_promotions.length <= 0){
            this.order.compute_cl_promotions();
        }
    }
    set_discount(discount){
        super.set_discount(...arguments);
        if(!this.cl_promotions || this.cl_promotions.length <= 0){
            this.order.compute_cl_promotions();
        }
    }
    set_lst_price(price){
        super.set_lst_price(...arguments);
        if(!this.cl_promotions || this.cl_promotions.length <= 0){
            this.order.compute_cl_promotions();
        }
    }
};

Registries.Model.extend(PosGlobalState, PromotionProgramPosGlobalState);
Registries.Model.extend(Order, PromotionProgramOrder);
Registries.Model.extend(Orderline, PromotionProgramOrderline);

});