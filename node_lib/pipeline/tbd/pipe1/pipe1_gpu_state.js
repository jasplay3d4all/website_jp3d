module.exports = function () {
    var module = {};

    module.pipeline_state = {
        name: "pipe1",
        cur_stage_idx: 0,
        num_stages: 1, // 
        stage_state:[{
            config:[// Stage 0: Base config state
                {label: "Theme", id: "theme", val:"food" },
                {label: "Num Scenes", id: "num_scene", val:4 },// number of scenes to be used for this ad
            ],
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
        config:[ // State 1: Image generation state
            {label: "FG Prompt", id: "fg_prompt", val:"all the worlds a stage" },
            {label: "BG Prompt", id: "bg_prompt", val:"We are all mere players" },
        ],
        gpu_state:{
            function: "gen_img", // Image generation id
            stage_status:"in_queue", // "pre_stage" "in_queue", "gpu_triggered", "error", "complete"
            stage_progress: 0, // Percentage of task completion
        }
    }
    module.stage2_state = {
        config:[ // State 2: Video motion generation state
            {label: "Motion Template", id: "motion_template", val:"pan_right" }, // motion template for N scenes - Zoom, Pan right, Pan left
        ],
        gpu_state:{
            function: "gen_vdo", // Video generation id
            stage_status:"pre_stage", // "pre_stage" "in_queue", "gpu_triggered", "error", "complete"
            stage_progress: 0, // Percentage of task completion
        }
    }
    module.stage3_state ={
        config:[ // State 3: Video stitching state
            {label: "Video Ordering", id: "video_ordering", val:"default" },// "default", "1,2,3,L", "2,1,3,L" L - logo
        ],
        gpu_state:{
            function: "order_vdo", // Video ordering id
            stage_status:"pre_stage", // "pre_stage" "in_queue", "gpu_triggered", "error", "complete"
            stage_progress: 0, // Percentage of task completion
        }
    }
    return module;
};