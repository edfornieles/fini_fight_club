"""Apply a converted clip GLB to the character GLB and render 3 frames so the
agent can visually verify (intact vs exploded) without a browser.
Usage: blender -b -P render_check.py -- <char.glb> <clip.glb> <out_prefix>
"""
import bpy, sys

argv = sys.argv[sys.argv.index("--")+1:]
char_glb, clip_glb, out_prefix = argv

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=char_glb)
char = next(o for o in bpy.data.objects if o.type=="ARMATURE")
pre_actions = set(bpy.data.actions)

bpy.ops.import_scene.gltf(filepath=clip_glb)
new_actions = [a for a in bpy.data.actions if a not in pre_actions]
if not new_actions:
    raise SystemExit("no action in clip glb")
act = max(new_actions, key=lambda a: a.frame_range[1]-a.frame_range[0])
# remove the clip's own armature objects (keep only the action)
for o in list(bpy.data.objects):
    if o.type == "ARMATURE" and o is not char:
        bpy.data.objects.remove(o, do_unlink=True)

char.animation_data_create()
char.animation_data.action = act
# Blender 4.4+/5.x layered actions: animation only evaluates once a slot is
# assigned (without it the armature silently stays in rest pose).
try:
    if act.slots:
        char.animation_data.action_slot = act.slots[0]
except AttributeError:
    pass
f0, f1 = (int(act.frame_range[0]), int(act.frame_range[1]))
sc = bpy.context.scene

# camera + light
cam_data = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_data)
sc.collection.objects.link(cam)
cam.location = (0, -4.2, 1.1)
cam.rotation_euler = (1.45, 0, 0)
sc.camera = cam
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sc.collection.objects.link(sun); sun.rotation_euler = (0.8, 0.2, 0)

sc.render.engine = "BLENDER_WORKBENCH"
sc.render.resolution_x = 420; sc.render.resolution_y = 420
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "MATERIAL"

for tag, fr in [("a", f0 + max(1,(f1-f0)//10)), ("b", (f0+f1)//2), ("c", f0 + (f1-f0)*9//10)]:
    sc.frame_set(int(fr))
    sc.render.filepath = f"{out_prefix}_{tag}.png"
    bpy.ops.render.render(write_still=True)
print("RENDERED", out_prefix)
