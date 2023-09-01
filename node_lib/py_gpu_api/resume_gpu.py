
from jarvis_api import get_instance_by_name

instance = get_instance_by_name()
instance.resume()

# # RTX5000(16 gb), RTX6000 (24 GB), A100(40), A6000(48) and A5000 (24)
# instance.resume(num_gpus=1,
#                 gpu_type='RTX5000',
#                 hdd=20,
#                 is_reserved=False)

