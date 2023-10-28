// const { data } = require("@tensorflow/tfjs");
const debounce = require('debounce')

module.exports = function (utils, db, sio, payment, bot) {
    var module = {};
    var single_state_pipe = require("./single_state.js")(utils, bot)

    pipe_state_list = {
        // 'pipe1': require("./pipe1/pipe1_gpu_state.js")().pipeline_state,
        // 'product_paradise': require("./product_paradise/product_paradise_gpu_state.js")().pipeline_state,
        'social_media_post': require("./pipe_list/social_media_post_gpu_state.js")().pipeline_state,
        'social_media_vdo': require("./pipe_list/social_media_vdo_gpu_state.js")().pipeline_state,
        'ctrlimg_vdo_ado': require("./pipe_list/pipe_gen_ctrlimg_vdo_ado.js")().pipeline_state,
        'ctrl_multiple_imgs': require("./pipe_list/pipe_gen_ctrl_multiple_imgs.js")().pipeline_state,
        'img_with_txt_prompt': require("./pipe_list/pipe_gen_img_with_txt_prompt.js")().pipeline_state,
        'social_media_vdowithlogo': require("./pipe_list/social_media_vdowithlogo_gpu_state.js")().pipeline_state,
        'talking_head': require("./pipe_list/talking_head_gpu_state.js")().pipeline_state,
    }
    // pipe_list = {
    //     // 'pipe1': require("./pipe1/pipe1.js")(utils, bot),
    //     // 'product_paradise': require("./product_paradise/product_paradise.js")(utils, bot),
    //     // 'single_state': require("./single_state.js")(utils, bot)
    // }
    var update_state = function(pipe_state, state_status=undefined){
        var user_id=pipe_state.user_state.info.id
        // utils.log("Stage state ", user_id, state_status );
        if(state_status !== undefined){
            var stage_state = pipe_state.stage_state[pipe_state.cur_stage_idx];
            stage_state.gpu_state.stage_status = state_status;
        }
        db.active_wrksp[user_id] = pipe_state;
        // db.dbWrite();
    }
    module.process_cmdline = function(user_info, pipe_type){
        // Check whether job queue has the user.
        // Currently support only one user in the job ques having one workspace for a user        
        var user_id = user_info.id
        if(pipe_state_list[pipe_type] === undefined){ 
            utils.log("Pipe state not available in list of implemented pipes ", 
                Object.keys(pipe_state_list), pipe_type, 
                pipe_state_list[pipe_type], pipe_type in pipe_state_list);
            return null; 
        }
        pipe_state = JSON.parse(JSON.stringify(pipe_state_list[pipe_type])); 
        pipe_state.user_state.info.id = user_id;
        pipe_state.user_state.info.channelid = user_info.channelid;
        pipe_state.user_state.info.attachments = user_info.attachments;
        // utils.log("Pipe state ", pipe_state, pipe_list[pipe_state.name])
        // Check whether user has sufficient credit KJN TBD
        if(payment.userCreditCheck(user_id, single_state_pipe.get_processing_cost(pipe_state))){
            // Do the validation of the user input for the stage and job available in the pipe
            single_state_pipe.process_cmdline(pipe_state)
            // save the state in db
            db.active_wrksp[user_id] = pipe_state;
            db.dbWrite()
        }                
    }
    module.process_interaction = function(interaction){
        var user_id = interaction.data.custom_id.split('-')[1]; // 1 Encodes the userid
        // Check whether job exist in active workspace and the job is not in active queue
        // if(user_id in db.active_wrksp && !db.queue.includes(user_id)){ 
        if(user_id in db.active_wrksp){ pipe_state = db.active_wrksp[user_id] }
        else{ utils.log("Pipe state not available in aktive workspace or queue ", 
            interaction.data.custom_id, db.active_wrksp); return null;}

        // Check whether user has sufficient credit KJN TBD
        if(payment.userCreditCheck(user_id, single_state_pipe.get_processing_cost(pipe_state))){
            // Trigger the next stage for processing and add it to queue
            var trig_gpu = single_state_pipe.process_interaction(pipe_state, interaction)
            // save the state in db
            if(trig_gpu){
                db.queue.push(user_id);
                // var pipe_state = db.active_wrksp[user_id]
                // var stage_state = pipe_state.stage_state[pipe_state.cur_stage_idx]
                // stage_state.gpu_state.stage_status = 'in_queue'
                // db.dbWrite()
                update_state(pipe_state, state_status='in_queue');
                this.process_queue();
            }
        }
        else{
            utils.log("Hey! Time to recharge.", );
        }
    }
    // Function to be called prediodically so that it checks the status of GPU and assigns the task if GPU is idle
    // IF the queue is idle for some period or time and GPU is not used stop the GPU. 
    // Once the queue has some data start processing
    // The active workspace should be cleaned preriodically like probably not more than a day or based on size
    // Add timestamp for the last time a user accessed the workspace
    // See the list of unprocessed functions and process it one by one
    module.process_queue = process_queue = function(){ 
        if(db.queue.length){
            // Pick the first job and emit its state for processing
            var user_id = db.queue[0]
            var pipe_state = db.active_wrksp[user_id]
            var stage_state = pipe_state.stage_state[pipe_state.cur_stage_idx]
            utils.log("Process queue ",user_id, pipe_state.cur_stage_idx, 
                stage_state.gpu_state.stage_status, db.queue.length,
                pipe_state.stage_state.length)
            if(pipe_state.cur_stage_idx >= pipe_state.stage_state.length){
                // Not sure when this stage happens. Remove it if not required
                db.queue.splice(0, 1); // 2nd parameter means remove one item only
                db.active_wrksp.pop(user_id);
                // db.dbWrite();
                this.process_queue();
            }
            else if(stage_state.gpu_state.stage_status === 'complete' ||
               stage_state.gpu_state.stage_status === 'error'){
                // if(stage_state.gpu_state.stage_status === 'complete'){
                //     pipe_state.cur_stage_idx += 1;
                // }
                db.queue.splice(0, 1);
                db.active_wrksp[user_id] = pipe_state;
                // db.dbWrite();
                this.process_queue();
            }
            else if(stage_state.gpu_state.stage_status === 'in_queue'){
                // utils.log("Triggered gpu start ", )
                db.active_wrksp[user_id].stage_state[pipe_state.cur_stage_idx].gpu_state.stage_status = 'gpu_triggered';
                sio.emit('gpu_job_start', pipe_state);
                // db.dbWrite();
            }
        }
        else{
            utils.log("Yo! the queue is empty.")
        }
    }
    // process_queue=debounce(process_queue,30000,true) // at least 30 seconds between checks

    // Socket listeners for invokeai backend api
    //socket.on("connect", (socket) => {log(socket)})
    sio.on("gpu_job_progress", (pipe_state) => {
        update_state(pipe_state);
        single_state_pipe.update_job_progress(pipe_state)
    })
    sio.on("gpu_job_complete", (pipe_state) => {
        // Based the pipe_state returned is not same as the one in active workspace. 
        // So update the active workspace with pipe_state
        update_state(pipe_state, state_status='complete');
        // Use the pipe_state to update the UI and calculate the processing cost and then update payments
        payment.chargeCredits(pipe_state.user_state.info.id, single_state_pipe.get_processing_cost(pipe_state));

        single_state_pipe.job_complete(pipe_state);
        // Process the next in queue and switch state
        this.process_queue();
    })
    sio.on("gpu_job_error", (pipe_state) => {
        // Based the pipe_state returned is not same as the one in active workspace. 
        // So update the active workspace with pipe_state
        update_state(pipe_state, state_status='error');
        single_state_pipe.job_error(pipe_state);
        // Process the next in queue and switch state
        this.process_queue();
    })

    return module;
};

// const viewQueue=()=>{ // admin function to view queue data
//     time('viewQueue')
//     var queueNew=queue.filter((q)=>q.status==='new')
//     var queueRendering=queue.filter((q)=>q.status==='rendering')
//     var queueFailed=queue.filter((q)=>q.status==='failed')
//     var queueCancelled=queue.filter((q)=>q.status==='cancelled')
//     var queueDone=queue.filter((q)=>q.status==='done')
//     var msg='**Queue Stats:**\n`'+queueNew.length+'` pending, `'+queueRendering.length+'` rendering, `'+queueFailed.length+'` failed, `'+queueCancelled.length+'` cancelled, `'+tidyNumber(queueDone.length)+'` done\n'
//     queueRendering.forEach((q)=>{msg+=':fire: JobId `'+q.id+'` rendering for `'+q.username+'` userid `'+q.userid+'`\nPrompt: `'+q.prompt+'`\n'})
//     queueNew.forEach((q)=>{msg+=':clock1: JobId `'+q.id+'` pending for `'+q.username+'` userid `'+q.userid+'`\nPrompt: `'+q.prompt+'`\n'})
//     msg+='```yaml\n!cancel                 to cancel the current render\n!canceljob jobid        to cancel a specific job id\n!canceluser userid      to cancel all jobs from that user id\n```'
//     //var components=[{type:1,components:[{type:2,label:'Refresh',custom_id:'viewQueue',emoji:{name:'🔄',id:null},disabled:false}]}]
//     sliceMsg(msg).forEach((m)=>{try{directMessageUser(config.adminID, {content:m})}catch(err){debugLog(err)}})
//     timeEnd('viewQueue')
//   }
    // socket.on("generationResult", (data) => {generationResult(data)})
    // socket.on("postprocessingResult", (data) => {postprocessingResult(data)})
    // socket.on("systemConfig", (data) => {debugLog('systemConfig received');currentModel=data.model_weights;models=data.model_list})
    // socket.on("modelChanged", (data) => {currentModel=data.model_name;models=data.model_list;debugLog('modelChanged to '+currentModel)})
    // var progressUpdate = {currentStep: 0,totalSteps: 0,currentIteration: 0,totalIterations: 0,currentStatus: 'Initializing',isProcessing: false,currentStatusHasSteps: true,hasError: false}
    // socket.on("progressUpdate", (data) => {
    // progressUpdate=data
    // if(['common.statusProcessing Complete'].includes(data['currentStatus'])){//'common:statusGeneration Complete'
    //     intermediateImage=null
    //     if(dialogs.queue!==null){
    //     dialogs.queue.delete().catch((err)=>{debugLog(err)}).then(()=>{
    //         dialogs.queue=null;intermediateImage=null;queueStatusLock=false
    //     })
    //     }
    // } else {
    //     queueStatus()
    // }
    // })
    // var intermediateImage=null
    // var intermediateImagePrior=null
    // socket.on("intermediateResult", (data) => {
    // if(!showPreviews)return
    // buf=new Buffer.from(data.url.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    // if(buf!==intermediateImagePrior){ // todo look at image difference % instead
    //     jimp.read(buf, (err,img)=>{
    //     if(err){log(err)}
    //     side=Math.max(img.bitmap.width,img.bitmap.height)
    //     scale=Math.round(448/side)
    //     img.scale(scale, jimp.RESIZE_NEAREST_NEIGHBOR) // RESIZE_NEAREST_NEIGHBOR fastest but bad quality // RESIZE_BILINEAR is better quality, slower
    //     img.getBuffer(img.getMIME(),(err,img2)=>{
    //         intermediateImage=img2
    //         intermediateImagePrior=buf
    //         if(!queueStatusLock){queueStatus()}
    //     })
    //     })
    // }
    // })
    // socket.on("foundLoras", (answer) =>{lora=answer.map(item=>item.name).sort()})
    // socket.on("foundTextualInversionTriggers", (answer) =>{debugLog(answer);ti=answer.local_triggers.map(item=>item.name).map(str => str.replaceAll('<', '').replaceAll('>', '')).sort()})
    // socket.on('error', (error) => {
    // log('Api socket error'.bgRed);log(error)
    // var nowJob=queue[queue.findIndex((j)=>j.status==="rendering")]
    // if(nowJob){
    //     log('Failing status for:');nowJob.status='failed';log(nowJob)
    //     chatChan(nowJob.channel,':warning: <@'+nowJob.userid+'>, there was an error in your request with prompt: `'+nowJob.prompt+'`\n**Error:** `'+error.message+'`\n')
    // }
    // rendering=false
    // })


