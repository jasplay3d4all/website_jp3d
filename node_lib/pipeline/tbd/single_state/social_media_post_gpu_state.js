module.exports = function () {
    var module = {};

    module.pipeline_state = {
        name: "single_state",
        cur_stage_idx: 0,
        pipe_info:{label:"Social Media Post", id:"social_media_post"}, //Not sure whether it is required
        user_state:{
            info:{
                id:"JAYKANIDAN",
                attachments: [{url:"./share_vol/data_io/inp/logo_mealo.png", 
                    filename: '00000.png', width: 512, height: 512, content_type: 'image/png'}]
            },
            gpu_state:{} //Not sure whether it is required. Probably future use
        },
        stage_state:[{
            // Stage 0: Generate the logo image
            // gen_logo(logo_path, theme, prompt, op_fld, control_type="pidiedge", **gen_img_args)
            config:{ 
                logo_path:{val : "", show: false, type:"attachments"},
                theme:{val : "food", label: "Theme", show: true, type:"default"},
                prompt:{val : "foodphoto, splashes, Strawberry icecream with chocolate sauce <lora:more_details:0.7>" + "Desert with camels and sand dunes",
                        label: "Prompt", show: true, type:"default"},
                op_fld:{val : "./img/", show: false, type:"path"}
            },
            gpu_state:{ 
                function: "gen_logo", // Name of the function to call
                stage_status:"in_queue", // "pre_stage" "in_queue", "gpu_triggered", "error", "complete"
                stage_progress: 0, // Percentage of task completion
                output:[{path:"./JAYKANIDAN/1/vdo/vdo/00000.png"},
                        {path:"./JAYKANIDAN/1/vdo/vdo/00000.png"}],
            }}, {
            // Stage 1: Generate the different dimensions for different social media format
            // gen_inpaint_filler(theme, prompt, img_path, imgfmt_list, op_fld)
            config:{ 
                img_path:{val : {stg_idx:0, type:"array2idx", idx:0}, show: false, type:"wrkflw_link"},
                theme:{val : "food", label: "Theme", show: true, type:"default"},
                prompt:{val : "foodphoto, splashes, Strawberry icecream with chocolate sauce <lora:more_details:0.7>. Desert with camels and sand dunes",
                        label: "Prompt", show: true, type:"default"},
                imgfmt_list:{val:"insta_square, insta_potrait, twit_instream",
                        label: "Image Format", show: true, type:"array"},
                op_fld:{val : "./logo_list/", show: false, type:"path"}
            },
            gpu_state:{ 
                function: "gen_inpaint_filler", // Name of the function to call
                stage_status:"in_queue", // "pre_stage" "in_queue", "gpu_triggered", "error", "complete"
                stage_progress: 0, // Percentage of task completion
                output:{path:"./JAYKANIDAN/1/vdo/mrg/generated.mp4"},
            }},
        ],
    }

    return module;
};