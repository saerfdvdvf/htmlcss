#!/bin/bash

# Array vacío donde guardaremos los números
numeros=()

# Pedimos 10 números al usuario
for i in 1 2 3 4 5 6 7 8 9 10
do
    read -p "Escribe el número $i: " num
    numeros+=($num)
done

# Aquí vamos guardando la suma
suma=0

# Recorremos el array número a número
for num in "${numeros[@]}"
do
    suma=$(( suma + num ))
done

# Cuántos números hay en el array
total=${#numeros[@]}

# La media es la suma entre el total
# Bash no saca decimales, así que la sacamos en dos partes
entero=$(( suma / total ))
decimal=$(( suma * 10 / total % 10 ))

echo "Números: ${numeros[@]}"
echo "Suma: $suma"
echo "Media: $entero.$decimal"
