
// # Avoid taking db or payment to avoid confusion of responsiblities
// pipe1 does not deal with talking to the GPU. This only interacts with the UI bot and create appropriate UI based changes
// REceives the input from bot, validates the inputs and maps to the pipe state to be consumed by GPU
// Receives the status update from GPU and updates the UI message to be shown
module.exports = function (utils, bot) {
    var module = {};
    var id_splt = "-"
    // Move to separate common file
    function create_ui(pipe_state, stage_idx, disabled=false, extra_msg=''){
        var user_id = pipe_state.user_state.info.id
        var channelid = pipe_state.user_state.info.channelid
        var pipe_info = pipe_state.pipe_info;
        // var stage_idx = pipe_state.cur_stage_idx
        var msg=':brain:<@'+user_id+'>' + extra_msg
        var pipe_cfg_tag = pipe_info.id+id_splt+user_id+id_splt+stage_idx.toString()+id_splt // Elements id differentiated by "_".
        var newMessage = { content: msg,
            embeds: [{description: pipe_info.label+" Stage "+stage_idx.toString()+" Config", 
                color: utils.getRandomColorDec()}], components: [ { type: 1,flags:64, components: [ ] } ] }
        
        var stage_config = pipe_state.stage_state[stage_idx].config;
        Object.keys(stage_config).forEach(id => {
            // utils.log("custom_id ", pipe_cfg_tag+id, stage_config[id])
            if(stage_config[id].show){
                newMessage.components[0].components.push({ type: 2, style: 2, label: stage_config[id].label, 
                    custom_id: pipe_cfg_tag+id, emoji: { name: '🎲', id: null}, disabled: disabled }) 
            }});
        newMessage.components[0].components.push(
            { type: 2, style: 2, label: "Submit", custom_id: pipe_cfg_tag+"submit", emoji: { name: '🎲', id: null}, disabled: disabled })
        return newMessage;
    }
    function create_op_ui(pipe_state, stage_idx, disabled=false, output_links=null){
        var user_id = pipe_state.user_state.info.id
        var channelid = pipe_state.user_state.info.channelid
        var pipe_info = pipe_state.pipe_info;
        
        var pipe_cfg_tag = pipe_info.id+id_splt+user_id+id_splt+stage_idx.toString()+id_splt // Elements id differentiated by "_".
        var newMessage = {}
        newMessage['content'] = ':brain:<@'+user_id+'>' + pipe_info.label+" Stage "+stage_idx.toString()+" Config";
        if(output_links){
            var msg=''
            for(let i=0; i<output_links.length; i++){
                msg += i.toString(2)+') '+output_links[i]+' \n'
            }
            newMessage['embeds'] = [{description: msg, color: utils.getRandomColorDec()}]
        }
        
        newMessage['components'] = [ { type: 1,flags:64, components: [ ] } ] 

        newMessage.components[0].components.push(
            { type: 2, style: 2, label: "Look's Good", custom_id: pipe_cfg_tag+"accept", emoji: { name: '🎲', id: null}, disabled: disabled })

        newMessage.components[0].components.push(
            { type: 2, style: 2, label: "Naa. One more", custom_id: pipe_cfg_tag+"retry", emoji: { name: '🎲', id: null}, disabled: disabled })
        return newMessage;
    }
    // Move to separate common file
    function handle_ui_interaction(pipe_state, interaction){
        var scid = interaction.data.custom_id.split(id_splt);
        var cid = interaction.data.custom_id;
        var param = scid[3];
        var user_id = scid[1];
        var stage_config = pipe_state.stage_state[pipe_state.cur_stage_idx].config
        if(cid.endsWith('modal')){
            // Store the user input in pipe_state for validation
            var usr_inp = interaction.data.components[0].components[0].value;
            var id = interaction.data.components[0].components[0].id
            Object.keys(stage_config).forEach(id => { if(id === param){stage_config[id].val = usr_inp;}  })
            // utils.log("Split cid ", scid, cid.endsWith('modal'))
            return interaction.editParent({content:':brain:<@'+user_id+'>'+param+" updated"}).then(()=>{}).catch(e=>{if(e){}})
        }
        else{
            var par_id = interaction.data.custom_id;
            var ps_val = null;
            Object.keys(stage_config).forEach(id => { if(id === param){ps_val = stage_config[id].val;} });
            
            return interaction.createModal({custom_id:par_id+id_splt+'modal' ,title:'Edit '+param,
                components:[{type:1,components:[{type:4,custom_id:par_id+id_splt+'modal1',
                label:'Edit '+param,style:2,value:ps_val,required:true}]}]}).then((r)=>{}).catch((e)=>{utils.log(e)})    
        }
    }

    module.process_cmdline =  process_cmdline = function(pipe_state){
        var channelid = pipe_state.user_state.info.channelid;
        // TBD Later
        // During commandline make sure you add the necessary attachments required by pipeline
        // store the image in GPU and store the path in pipe_state
        new_message = create_ui(pipe_state, pipe_state.cur_stage_idx);
        bot.createMessage(channelid, new_message);
    }
    function validate_cfg(stage_config){
        Object.keys(stage_config).forEach(id => {
            // TO DO: Add validation for each configuration. Check with UI
        });

        return true
    }
    module.process_interaction = function(pipe_state, interaction){
        // cid 0-"pipeline name", 1-"userid", 2-"cur_stage_idx", 3-"cfg param"
        var scid = interaction.data.custom_id.split(id_splt);
        var cur_stage_idx = parseInt(scid[2]);        
        var param = scid[3];
        var stage_state = pipe_state.stage_state[pipe_state.cur_stage_idx];
        if(param === 'retry'){
            interaction.editParent(create_op_ui(pipe_state, pipe_state.cur_stage_idx, 
                disabled=true,output_links=null)).catch((e) => {console.error(e)});
            return true;
        }
        else if(param === 'accept'){
            interaction.editParent(create_op_ui(pipe_state, pipe_state.cur_stage_idx, 
                disabled=true)).catch((e) => {console.error(e)});
            if(stage_state.gpu_state.stage_status === 'complete'){
                pipe_state.cur_stage_idx += 1;
            }
            if(pipe_state.cur_stage_idx < pipe_state.stage_state.length){
                var channelid = pipe_state.user_state.info.channelid;
                bot.createMessage(channelid, create_ui(pipe_state, pipe_state.cur_stage_idx));
            }
            return false;
        }
        else if(param === 'submit'){
            // Validate all the inputs for configuration and update state
            if(!validate_cfg(stage_state.config)){
                // Error in input configuration  
                interaction.editParent({content:':floppy_disk: ** CFG Error '+stage_state.config+ 'is invalid',
                    components:[]}).catch((e) => {console.error(e)});
                return false
            }
            else{
                interaction.editParent(create_ui(pipe_state, pipe_state.cur_stage_idx, 
                    disabled=true, extra_msg=' Process Submitted to GPU')).catch((e) => {console.error(e)});
                return true;
            }   
        }
        else{handle_ui_interaction(pipe_state, interaction)}
    }
    module.get_processing_cost = function(pipe_state){ // Based on the current stage calculate the corresponding cost
        return 1;
    }
    module.update_job_progress = function(pipe_state){gen_bot_response(pipe_state)}
    module.job_error = function(pipe_state){
        // Show Error message and ask if the next state has to be regeneration or quit
        gen_bot_response(pipe_state)
    }

    module.job_complete = function(pipe_state){
        // Display completed image
        // Ideally ask if it fine and want to move to next task
        // If yes, increment and ask the next configuration
        // Else, regenerate another set of images
        // stage_state.gpu_state.output
        
        // Then check the next state and render the corresponding UI for it
        var channelid = pipe_state.user_state.info.channelid;
        var cur_stage_idx = pipe_state.cur_stage_idx; // IMPORTANT: Store the cur_stage_idx before it gets updated 
        var gpu_state = pipe_state.stage_state[pipe_state, cur_stage_idx].gpu_state
        var new_msg = create_op_ui(pipe_state, cur_stage_idx, disabled=false, gpu_state["tmpfile_output"])
        bot.createMessage(channelid, new_msg);
    }

    function gen_bot_response(pipe_state){
        var gpu_state = pipe_state.stage_state[pipe_state.cur_stage_idx].gpu_state
        var msg='<@'+pipe_state.user_state.info.id+'> stage number'+pipe_state.cur_stage_idx+
            ' stage progress '+gpu_state.progress+' stage status '+gpu_state.status
        bot.createMessage(user_info.channelid, msg).then().catch(err=>{utils.log(err)})
    }
    return module;
};

        // // console.log("Output Message ", new_message, gpu_state, new_message.components[0].components)
        // if("output" in gpu_state){
        //     if(Array.isArray(gpu_state["output"])){ path_url = gpu_state["output"][0].path; }
        //     else{ path_url = gpu_state["output"].path; }
        //     var url = "http://127.0.0.1:80/static/"+path_url;
        //     // console.log("Output URL ", url)
        //     var image=axios({ 
        //     url: url, // "http://127.0.0.1:80/static/logo_mealo.png", 
        //     responseType: "arraybuffer" }).then(function (response) {
        //         // utils.log("Output image ", response.data)
        //         // new_message['file'] = response.data;
        //         // new_message['content'] = new Date().getTime()+'-text.png \n' + new_message['content'];
        //         bot.createMessage(channelid, 'Finished Processing', {file: response.data, name: new Date().getTime()+'-text.png'})
        //         if(cur_stage_idx + 1 < pipe_state.stage_state.length){
        //             var new_message = create_ui(pipe_state, cur_stage_idx + 1);
        //             // console.log("Output idx message ", cur_stage_idx, pipe_state.stage_state.length)
        //             new_message['content'] = 'https://tmpfiles.org/1900371/generated123.mp4 \n' + new_message['content'];
        //             bot.createMessage(channelid, new_message);
        //         }
        //     });
        // }
        // else if(cur_stage_idx + 1 < pipe_state.stage_state.length){
        //     var new_message = create_ui(pipe_state, cur_stage_idx + 1);
        //     bot.createMessage(channelid, new_message);
        // }