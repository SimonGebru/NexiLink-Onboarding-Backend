import Todo from "../models/Todo.model.js";

export const getTodos = async (req, res) => {
  const todos = await Todo
    .find({ userId: req.user.id })
    .sort({ createdAt: -1 });

  const formattedTodos = todos.map((todo) => ({
    id: todo._id,
    text: todo.text,
    completed: todo.completed,
  }));
  res.json(formattedTodos);
};

export const createTodo = async (req, res) => {
  const { text } = req.body;
  const newTodo = await Todo.create({
    userId: req.user.id,
    text,
  });
  res.status(201).json({
    id: newTodo._id,
    text: newTodo.text,
    completed: newTodo.completed,
  });
};

export const updateTodo = async (req, res) => {
  const { completed } = req.body;
  const updatedTodo = await Todo.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { completed },
    { returnDocument: "after" },
  );
  if (!updatedTodo)
    return res.status(404).json({ message: "Todo hittades inte" });
  res.json({
    id: updatedTodo._id,
    text: updatedTodo.text,
    completed: updatedTodo.completed,
  });
};

export const deleteTodo = async (req, res) => {
  await Todo.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.status(204).send();
};
