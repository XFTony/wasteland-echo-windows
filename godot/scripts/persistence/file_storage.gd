class_name FileStorage
extends RefCounted
## Temp-file replacement prevents an interrupted write from truncating the only save.

var directory: String


func _init(storage_directory: String = "user://saves") -> void:
	directory = storage_directory


func get_value(key: String) -> Variant:
	var filename: String = directory.path_join(key + ".json")
	if not FileAccess.file_exists(filename):
		return null
	var file: FileAccess = FileAccess.open(filename, FileAccess.READ)
	if file == null:
		return {"storageError": FileAccess.get_open_error()}
	return file.get_as_text()


func set_value(key: String, value: String) -> bool:
	var root: String = ProjectSettings.globalize_path(directory)
	if DirAccess.make_dir_recursive_absolute(root) != OK:
		return false
	var destination: String = root.path_join(key + ".json")
	var temporary: String = destination + ".tmp"
	var file: FileAccess = FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(value)
	file.flush()
	var error: Error = file.get_error()
	file.close()
	if error != OK:
		return false
	return DirAccess.rename_absolute(temporary, destination) == OK
