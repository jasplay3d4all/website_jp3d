const fsPromises = require('fs').promises
const pipe1_state_template = require("./pipe1_gpu_state.js")()

// # Avoid taking db or payment to avoid confusion of responsiblities
// pipe1 does not deal with talking to the GPU. This only interacts with the UI bot and create appropriate UI based changes
// REceives the input from bot, validates the inputs and maps to the pipe state to be consumed by GPU
// Receives the status update from GPU and updates the UI message to be shown
module.exports = function (utils, bot) {
    var module = {};
    var module_name = "pipe1"
    var id_splt = "-"

    function create_ui(pipe_state){
        var user_id = pipe_state.user_state.info.id
        var channelid = pipe_state.user_state.info.channelid
        var stage_idx = pipe_state.cur_stage_idx
        var msg=':brain:<@'+user_id+'>'
        var pipe_cfg_tag = module_name+id_splt+user_id+id_splt+stage_idx.toString()+id_splt // Elements id differentiated by "_".
        var newMessage = { content: msg,
            embeds: [{description: module_name+" Stage "+stage_idx.toString()+" Config", 
                color: utils.getRandomColorDec()}], components: [ { type: 1,flags:64, components: [ ] } ] }
        
        var stage_config = pipe_state.stage_state[stage_idx].config;
        for (idx in stage_config){
            newMessage.components[0].components.push({ type: 2, style: 2, label: stage_config[idx].label, 
                custom_id: pipe_cfg_tag+stage_config[idx].id, emoji: { name: '🎲', id: null}, disabled: false }) 
            // utils.log("custom_id ", pipe_cfg_tag+stage_config[idx].id, stage_config[idx], pipe_state)   
        }
        newMessage.components[0].components.push(
            { type: 2, style: 2, label: "Submit", custom_id: pipe_cfg_tag+"submit", emoji: { name: '🎲', id: null}, disabled: false })
        return newMessage;
    }
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
            for (idx in stage_config){
                if(stage_config[idx].id === param){stage_config[idx].val = usr_inp; break;}
            }
            utils.log("Split cid ", scid, cid.endsWith('modal'))
            return interaction.editParent({content:':brain:<@'+user_id+'>'+param+" updated"}).then(()=>{}).catch(e=>{if(e){}})
        }
        else{
            var par_id = interaction.data.custom_id;
            var ps_val = null;
            for (idx in stage_config){
                if(stage_config[idx].id === param){ps_val = stage_config[idx].val; break;}
            }
            return interaction.createModal({custom_id:par_id+id_splt+'modal' ,title:'Edit '+param,
                components:[{type:1,components:[{type:4,custom_id:par_id+id_splt+'modal1',
                label:'Edit '+param,style:2,value:ps_val,required:true}]}]}).then((r)=>{}).catch((e)=>{utils.log(e)})    
        }
    }
    function update_stages_in_pipe_state(stage_config, pipe_state){
        var stage_config_dict = get_dict_cfg(stage_config);
        // utils.log("Input cfg ", stage_config_dict);
        var num_scene = parseInt(stage_config_dict.num_scene);
        for(var i=0; i<num_scene; i++){
            pipe_state.stage_state.push(JSON.parse(JSON.stringify(pipe1_state_template.stage1_state)))
        }
        for(var i=0; i<num_scene; i++){
            pipe_state.stage_state.push(JSON.parse(JSON.stringify(pipe1_state_template.stage2_state)))
        }
        pipe_state.stage_state.push(JSON.parse(JSON.stringify(pipe1_state_template.stage3_state)))
        // utils.log("Update State ", pipe_state.stage_state)
        pipe_state.stage_state[0].gpu_state['num_scene'] = num_scene
    }
    function get_dict_cfg(config){ cfg_dict = {};for (idx in config){cfg_dict[config[idx].id] = config[idx].val}; return cfg_dict}

    module.process_cmdline =  process_cmdline = function(pipe_state){
        var channelid = pipe_state.user_state.info.channelid;
        new_message = create_ui(pipe_state);
        bot.createMessage(channelid, new_message);
    }
    module.process_interaction = function(pipe_state, interaction){
        var cid = interaction.data.custom_id.split(id_splt); // cid 0-"pipeline name", 1-"userid", 2-"cur_stage_idx"
        var cur_stage_idx = parseInt(cid[2]);
        var num_scene = pipe_state.stage_state[0].gpu_state['num_scene'];
        if(cur_stage_idx === 0){return handle_stage_0(pipe_state, interaction)}
        else if(cur_stage_idx <= 1*num_scene){return handle_stage_1(pipe_state, interaction)}
        else if(cur_stage_idx <= 2*num_scene){return handle_stage_2(pipe_state, interaction)}
        else if(cur_stage_idx === 2*num_scene+1){return handle_stage_3(pipe_state, interaction)}
    }
    module.get_processing_cost = function(pipe_state){ // Based on the current stage calculate the corresponding cost
        return 1;
    }

    function handle_stage_0(pipe_state, interaction){
        var scid = interaction.data.custom_id.split(id_splt);
        var param = scid[3];
        var stage_config = pipe_state.stage_state[pipe_state.cur_stage_idx].config
        if(param !== 'submit'){handle_ui_interaction(pipe_state, interaction)}
        else{
            // Validate all the inputs for configuration and update state
            for (stage_param in stage_config){
                if((stage_param.id === "theme" && stage_param.val !== "food") ||
                   (stage_param.id === "num_scene" && parseInt(stage_param.val) > 4) ||
                   (stage_param.id === "num_scene" && parseInt(stage_param.val) < -1)){   
                    utils.log("Error in cfg ", stage_param)
                    // Error in input configuration  
                    interaction.editParent({content:':floppy_disk: ** CFG Error '+stage_param.id+' val '+
                        stage_param.val+ 'is invalid',components:[]}).catch((e) => {console.error(e)})
                    return false
                }
            }
            // If all parameters are valid then move on to the next stage
            update_stages_in_pipe_state(stage_config, pipe_state);
            pipe_state.cur_stage_idx += 1
            interaction.editParent(create_ui(pipe_state)).catch((e) => {console.error(e)})
            return false
        }
    }
    function handle_stage_1(pipe_state, interaction){
        var scid = interaction.data.custom_id.split(id_splt);
        var param = scid[3];
        var user_id = scid[1];
        var stage_config = pipe_state.stage_state[pipe_state.cur_stage_idx].config
        if(param !== 'submit'){handle_ui_interaction(pipe_state, interaction)}
        else{
            // Validate all the inputs for configuration and update state
            for (stage_param in stage_config){
                if((stage_param.id === "fg_prompt" && stage_param.val.trim() === "") ||
                   (stage_param.id === "bg_prompt" && stage_param.val.trim() === "") ){   
                    utils.log("Error in cfg ", stage_param)
                    // Error in input configuration  
                    interaction.editParent({content:':floppy_disk: ** CFG Error '+stage_param.id+' val '+
                        stage_param.val+ 'is invalid',components:[]}).catch((e) => {console.error(e)});
                    return false
                }
            }
            interaction.editParent({content:':brain:<@'+user_id+'> Process Submitted to GPU'}).catch((e) => {console.error(e)});
            return true
        }
    }
    function handle_stage_2(pipe_state, interaction){
        var scid = interaction.data.custom_id.split(id_splt);
        var param = scid[3];
        var stage_config = pipe_state.stage_state[pipe_state.cur_stage_idx].config
        if(param !== 'submit'){handle_ui_interaction(pipe_state, interaction)}
        else{
            // Validate all the inputs for configuration and update state
            for (stage_param in stage_config){
                if(stage_param.id === "motion_template" && (stage_param.val.trim() === "pan_right" || 
                   stage_param.val.trim() === "pan_left" || stage_param.val.trim() === "zoom")){   
                    utils.log("Error in cfg ", stage_param)
                    // Error in input configuration  
                    interaction.editParent({content:':floppy_disk: ** CFG Error '+stage_param.id+' val '+
                        stage_param.val+ 'is invalid',components:[]}).catch((e) => {console.error(e)});
                    return false
                }
            }   
            return true
        }
    }
    module.update_job_progress = function(pipe_state){gen_bot_response(pipe_state)}
    module.job_error = function(pipe_state){gen_bot_response(pipe_state)}

    module.job_complete = function(pipe_state){
        // Display completed image
        // Ideally ask if it fine and want to move to next task
        // If yes, increment and ask the next configuration
        // Else, regenerate another set of images
        pipe_state.cur_stage_idx += 1;
        process_cmdline(pipe_state);
    }

    function gen_bot_response(pipe_state){
        var gpu_state = pipe_state.stage_state[pipe_state.cur_stage_idx].gpu_state
        var msg='<@'+pipe_state.user_state.info.id+'> stage number'+pipe_state.cur_stage_idx+
            ' stage progress '+gpu_state.progress+' stage status '+gpu_state.status
        bot.createMessage(user_info.channelid, msg).then().catch(err=>{utils.log(err)})
    }
    return module;
};
//     bot.editStatus('idle',idleStatusArr[0])
// buffer = buffer.data ? Buffer.from(buffer.data) : undefined
// try{bot.createMessage(channel, newMsgObject, {file: buffer, name: user+'-bg.png'})}catch(err){log(err)}

// var msg=':brain:<@'+job.userid+'>'
// var newMessage = { content: msg, embeds: [{description: nsfwWarning+job.prompt, color: getRandomColorDec()}], components: [ { type: 1, components: [ ] } ] }
// if(job.prompt.replaceAll(' ','').length===0){newMessage.embeds=[]}
// newMessage.components[0].components.push({ type: 2, style: 2, label: "ReDream", custom_id: "refresh-" + job.id, emoji: { name: '🎲', id: null}, disabled: false })
// newMessage.components[0].components.push({ type: 2, style: 2, label: "Edit Prompt", custom_id: "edit-"+job.id, emoji: { name: '✏️', id: null}, disabled: false })
// newMessage.components[0].components.push({ type: 2, style: 2, label: "Tweak", custom_id: "tweak-"+job.id+'-'+render.resultNumber, emoji: { name: '🧪', id: null}, disabled: false })
// if(newMessage.components[0].components.length<5){newMessage.components[0].components.push({ type: 2, style: 2, label: "Random", custom_id: "editRandom-"+job.id, emoji: { name: '🔀', id: null}, disabled: false })}
// if(newMessage.components[0].components.length===0){delete newMessage.components} // If no components are used there will be a discord api error so remove it
// var filestats=await fsPromises.stat(render.filename)
// var filesize=filestats.size
// if(filesize<defaultMaxDiscordFileSize){ // Within discord 25mb filesize limit
// try{
//     bot.createMessage(job.channel, newMessage, {file: data, name: postFilename})
//     .then(async m=>{
//         debugLog('Posted msg id '+m.id+' to channel id '+m.channel.id)
//         if(m.attachments.length>0){debugLog('"'+job.prompt+'" - '+m.attachments[0].proxy_url)}
//         debugLog(render.filename+' - '+(filesize/1000000).toFixed(2)+'mb')
//     }) // maybe wait till successful post here to change job status? Could store msg id to job
//     .catch((err)=>{
//         log('caught error posting to discord in channel '.bgRed+job.channel)
//         log(err)
//         failedToPost.push({channel:job.channel,msg:newMessage,file:data,name:filename+'.png'})
//     })
// }catch(err){console.error(err)}
// }else{
// log('Image '+filename+' was too big for discord, failed to post to channel '+job.channel)
// failedToPost.push({channel:job.channel,msg:newMessage,file:data,name:filename+'.png'})
// }


// changeModel