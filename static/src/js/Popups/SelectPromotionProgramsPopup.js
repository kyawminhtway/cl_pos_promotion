odoo.define('cl_pos_promotion.SelectPromotionProgramsPopup', function (require) {
'use strict';

const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
const Registries = require('point_of_sale.Registries');
const { useState } = owl;

class SelectPromotionProgramsPopup extends AbstractAwaitablePopup {
    setup() {
        super.setup();
        this.state = useState({selected_programs: []});
    }
    get hasSelectedAll(){
        for(var item in this.props.items){
            item = this.props.items[item];
            if(!this.state.selected_programs.includes(item.id)){
                return false;
            }
        }
        return true;
    }
    selectItem(item_id){
        this.state.selected_programs.push(item_id);
        console.log(this.state.selected_programs);
    }
    removeItem(item_id){
        this.state.selected_programs = this.state.selected_programs.filter(e => e !== item_id);
        console.log(this.state.selected_programs);
    }
    selectAll(){
        var program_ids = [];
        for(var item in this.props.items){
            program_ids.push(this.props.items[item].id);
        }
        this.state.selected_programs = program_ids;
    }
    removeAll() {
        this.state.selected_programs = [];
    }
    getPayload() {
        return this.state.selected_programs;
    }
}
SelectPromotionProgramsPopup.template = 'SelectPromotionProgramsPopup';
Registries.Component.add(SelectPromotionProgramsPopup);

return SelectPromotionProgramsPopup;
});
