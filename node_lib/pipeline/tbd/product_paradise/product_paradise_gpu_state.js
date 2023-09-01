module.exports = function () {
    var module = {};

    module.pipeline_state = {
        name: "product_paradise",
        cur_stage_idx: 0,
        num_stages: 1, // 
        stage_state:[{
            config:{// Stage 0: Base config state
                theme: {label: "Theme", val:"food" },
                num_scene: {label: "Num Scenes", val:1 },// number of scenes to be used for this ad
            },
            gpu_state:{ // Fixed by the pipeline type
                // num_stages: 3, // number of stages based on this template. Image Generation, Video Generation, Video Stitching
            }
        }], 
        user_state:{
            info:{
                id:"",
            },
            gpu_state:{
            }
        }
    }

    module.stage1_state = {
        config:{ // State 1: Image generation state
            fg_prompt: {label: "FG Prompt", val:"all the worlds a stage" },
            bg_prompt: {label: "BG Prompt", val:"We are all mere players" },
        },
        gpu_state:{
            function: "gen_img", // Image generation id
            stage_status:"pre_stage",// template initialized so it goes to the pipeline as is
                                     // "pre_stage" - when initialized based on stage 0, 
                                     // "in_queue" - when added to queue after ui confirmation, 
                                     // "gpu_triggered" - emit called to gpu, 
                                     // "error", "complete" - gpu updates the status
            stage_progress: 0, // Percentage of task completion
        }
    }
    module.stage2_state = {
        config:{ // State 2: Video motion generation state
            motion_template: {label: "Motion Template", val:"pan_right" }, // motion template for N scenes - Zoom, Pan right, Pan left
            bg_music_prompt: {label: "BG Music Prompt", val:"Funky drums" }, // BG Music
        },
        gpu_state:{
            function: "gen_vdo", // Video generation id
            stage_status:"pre_stage", // "pre_stage" "in_queue", "gpu_triggered", "error", "complete"
            stage_progress: 0, // Percentage of task completion
        }
    }

    module.stage3_state = {
        config:{ // State 2: Video motion generation state
            motion_template: {label: "Motion Template", val:"pan_right" }, // motion template for N scenes - Zoom, Pan right, Pan left
            voice_text: {label: "Tag Line", val:"Mealo: Your one stop solution for all your food craving" }, // BG Music
            logo_prompt: {label: "Logo bg", val:"cakes, chocolates, drinks, coffee, milk shakes" },
        },
        gpu_state:{
            function: "gen_logo", // Video generation id
            stage_status:"pre_stage", // "pre_stage" "in_queue", "gpu_triggered", "error", "complete"
            stage_progress: 0, // Percentage of task completion
        }
    }
    module.stage4_state ={
        config:{ // State 3: Video stitching state
        video_ordering: {label: "Video Ordering", val:"default" },// "default", "1,2,3,L", "2,1,3,L" L - logo
        },
        gpu_state:{
            function: "order_vdo", // Video ordering id
            stage_status:"pre_stage", // "pre_stage" "in_queue", "gpu_triggered", "error", "complete"
            stage_progress: 0, // Percentage of task completion
        }
    }
    return module;
};